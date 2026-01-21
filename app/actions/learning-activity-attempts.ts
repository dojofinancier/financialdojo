"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

const submitAttemptSchema = z.object({
  learningActivityId: z.string().min(1),
  answers: z.any(), // JSON structure varies by activity type
  timeSpent: z.number().int().nonnegative().optional(),
});

export type LearningActivityAttemptResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Submit a learning activity attempt
 */
export async function submitLearningActivityAttempt(
  data: z.infer<typeof submitAttemptSchema>
): Promise<LearningActivityAttemptResult> {
  try {
    const user = await requireAuth();

    const validatedData = submitAttemptSchema.parse(data);

    // Get the activity to check type and grading requirements
    const activity = await prisma.learningActivity.findUnique({
      where: { id: validatedData.learningActivityId },
      include: {
        contentItem: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      return {
        success: false,
        error: "Activity not found",
      };
    }

    // Grade the attempt (for auto-graded activities)
    let score: number | null = null;
    let isGraded = false;

    if (activity.activityType !== "DEEP_DIVE") {
      // Auto-grade for all types except deep dives
      score = gradeActivityAttempt(activity, validatedData.answers);
      isGraded = true;
    }

    // Create the attempt
    const attempt = await prisma.learningActivityAttempt.create({
      data: {
        userId: user.id,
        learningActivityId: validatedData.learningActivityId,
        answers: validatedData.answers,
        score,
        isGraded,
        timeSpent: validatedData.timeSpent || null,
      },
      include: {
        learningActivity: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return { success: true, data: attempt };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to submit learning activity attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error submitting activity",
    };
  }
}

/**
 * Get learning activity attempts for a user
 */
export async function getLearningActivityAttempts(
  learningActivityId: string
): Promise<LearningActivityAttemptResult> {
  try {
    const user = await requireAuth();

    const attempts = await prisma.learningActivityAttempt.findMany({
      where: {
        userId: user.id,
        learningActivityId,
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        answers: true,
        score: true,
        completedAt: true,
        timeSpent: true,
      },
    });

    return { success: true, data: attempts };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get learning activity attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while loading attempts",
      data: [],
    };
  }
}

/**
 * Batch load most recent attempts for multiple activities (optimized with server-side aggregation)
 * Returns a map of activityId -> { mostRecentAttempt, attemptCount }
 */
export async function getBatchLearningActivityAttempts(
  learningActivityIds: string[]
): Promise<LearningActivityAttemptResult> {
  try {
    const user = await requireAuth();

    if (learningActivityIds.length === 0) {
      return { success: true, data: {} };
    }

    // Get all attempts for the given activities in a single query
    // Then use JavaScript to get most recent per activity (more reliable than DISTINCT ON)
    const allAttempts = await prisma.learningActivityAttempt.findMany({
      where: {
        userId: user.id,
        learningActivityId: { in: learningActivityIds },
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        learningActivityId: true,
        answers: true,
        score: true,
        completedAt: true,
        timeSpent: true,
      },
    });

    // Group by activityId and get most recent (already sorted by completedAt desc)
    const mostRecentByActivity = new Map<string, typeof allAttempts[0]>();
    for (const attempt of allAttempts) {
      if (!mostRecentByActivity.has(attempt.learningActivityId)) {
        mostRecentByActivity.set(attempt.learningActivityId, attempt);
      }
    }

    // Get attempt counts in a single aggregation query
    const attemptCounts = await prisma.learningActivityAttempt.groupBy({
      by: ["learningActivityId"],
      where: {
        userId: user.id,
        learningActivityId: { in: learningActivityIds },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map(attemptCounts.map((c) => [c.learningActivityId, c._count.id]));

    // Build result map
    const result: Record<string, { mostRecentAttempt: any; attemptCount: number }> = {};
    
    for (const [activityId, attempt] of mostRecentByActivity) {
      result[activityId] = {
        mostRecentAttempt: {
          id: attempt.id,
          answers: attempt.answers,
          score: attempt.score,
          completedAt: attempt.completedAt,
          timeSpent: attempt.timeSpent,
        },
        attemptCount: countMap.get(activityId) || 0,
      };
    }

    // Ensure all requested activityIds are in the result (even if no attempts)
    for (const activityId of learningActivityIds) {
      if (!result[activityId]) {
        result[activityId] = {
          mostRecentAttempt: null,
          attemptCount: 0,
        };
      }
    }

    return { success: true, data: result };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to batch get learning activity attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while loading attempts",
      data: {},
    };
  }
}

/**
 * Grade an activity attempt based on activity type
 */
function gradeActivityAttempt(activity: any, userAnswers: any): number {
  const { activityType, correctAnswers, tolerance, content } = activity;

  switch (activityType) {
    case "SHORT_ANSWER":
      return gradeShortAnswer(userAnswers, correctAnswers);

    case "FILL_IN_BLANK":
      return gradeFillInBlank(userAnswers, correctAnswers);

    case "SORTING_RANKING":
      return gradeSortingRanking(userAnswers, content.items);

    case "CLASSIFICATION":
      return gradeClassification(userAnswers, correctAnswers || content.items);

    case "NUMERIC_ENTRY":
      return gradeNumericEntry(userAnswers, correctAnswers, tolerance);

    case "TABLE_COMPLETION":
      return gradeTableCompletion(userAnswers, correctAnswers);

    case "ERROR_SPOTTING":
      return gradeErrorSpotting(userAnswers, correctAnswers);

    case "DEEP_DIVE":
      // Deep dives are not auto-graded
      return 0;

    default:
      return 0;
  }
}

/**
 * Grade short answer: normalize and compare
 */
function gradeShortAnswer(userAnswer: string, correctAnswers: string[]): number {
  if (!userAnswer || !correctAnswers || !Array.isArray(correctAnswers)) return 0;

  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = correctAnswers.map((a) => normalizeAnswer(a));

  return normalizedCorrect.includes(normalizedUser) ? 100 : 0;
}

/**
 * Grade fill-in-the-blank
 */
function gradeFillInBlank(userAnswers: string[], correctAnswers: string[]): number {
  if (!userAnswers || !correctAnswers || !Array.isArray(userAnswers) || !Array.isArray(correctAnswers)) {
    return 0;
  }

  if (userAnswers.length !== correctAnswers.length) return 0;

  let correct = 0;
  for (let i = 0; i < correctAnswers.length; i++) {
    if (normalizeAnswer(userAnswers[i]) === normalizeAnswer(correctAnswers[i])) {
      correct++;
    }
  }

  return Math.round((correct / correctAnswers.length) * 100);
}

/**
 * Grade sorting/ranking
 */
function gradeSortingRanking(userOrder: string[], correctOrder: string[]): number {
  if (!userOrder || !correctOrder || !Array.isArray(userOrder) || !Array.isArray(correctOrder)) {
    return 0;
  }

  if (userOrder.length !== correctOrder.length) return 0;

  // Check if arrays match exactly
  const matches = userOrder.every((item, index) => item === correctOrder[index]);
  return matches ? 100 : 0;
}

/**
 * Grade classification
 */
function gradeClassification(userClassification: Record<string, string>, correctClassification: Record<string, string>): number {
  if (!userClassification || !correctClassification || typeof userClassification !== "object" || typeof correctClassification !== "object") {
    return 0;
  }

  const userKeys = Object.keys(userClassification);
  const correctKeys = Object.keys(correctClassification);

  if (userKeys.length !== correctKeys.length) return 0;

  let correct = 0;
  for (const key of correctKeys) {
    if (normalizeAnswer(userClassification[key]) === normalizeAnswer(correctClassification[key])) {
      correct++;
    }
  }

  return Math.round((correct / correctKeys.length) * 100);
}

/**
 * Grade numeric entry with tolerance
 */
function gradeNumericEntry(userAnswer: number, correctAnswer: number, tolerance: number | null): number {
  if (typeof userAnswer !== "number" || typeof correctAnswer !== "number") return 0;

  if (tolerance === null || tolerance === undefined) {
    // No tolerance specified, exact match required
    return userAnswer === correctAnswer ? 100 : 0;
  }

  // Check if tolerance is percentage (>= 1) or absolute (< 1)
  if (tolerance >= 1) {
    // Percentage tolerance
    const percentDiff = Math.abs((userAnswer - correctAnswer) / correctAnswer) * 100;
    return percentDiff <= tolerance ? 100 : 0;
  } else {
    // Absolute tolerance
    const diff = Math.abs(userAnswer - correctAnswer);
    return diff <= tolerance ? 100 : 0;
  }
}

/**
 * Grade table completion
 */
function gradeTableCompletion(userAnswers: Record<string, string>, correctAnswers: Record<string, string>): number {
  if (!userAnswers || !correctAnswers || typeof userAnswers !== "object" || typeof correctAnswers !== "object") {
    return 0;
  }

  const correctKeys = Object.keys(correctAnswers);
  if (correctKeys.length === 0) return 0;

  let correct = 0;
  for (const key of correctKeys) {
    if (normalizeAnswer(userAnswers[key] || "") === normalizeAnswer(correctAnswers[key] || "")) {
      correct++;
    }
  }

  return Math.round((correct / correctKeys.length) * 100);
}

/**
 * Grade error spotting
 */
function gradeErrorSpotting(userAnswer: string, correctAnswer: string): number {
  if (!userAnswer || !correctAnswer) return 0;

  // For error spotting, we do a fuzzy match since the description might vary
  const normalizedUser = normalizeAnswer(userAnswer).toLowerCase();
  const normalizedCorrect = normalizeAnswer(correctAnswer).toLowerCase();

  // Check if key terms match (simple approach - could be improved)
  const correctWords = normalizedCorrect.split(/\s+/).filter((w) => w.length > 3);
  const userWords = normalizedUser.split(/\s+/).filter((w) => w.length > 3);

  const matchingWords = userWords.filter((w) => correctWords.includes(w)).length;
  const similarity = correctWords.length > 0 ? matchingWords / correctWords.length : 0;

  // Require at least 50% similarity for partial credit
  if (similarity >= 0.8) return 100;
  if (similarity >= 0.5) return 50;
  return 0;
}

/**
 * Normalize answer: remove accents, lowercase, trim whitespace
 */
function normalizeAnswer(answer: string): string {
  if (typeof answer !== "string") return "";
  return answer
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .trim()
    .replace(/\s+/g, " "); // Normalize whitespace
}

