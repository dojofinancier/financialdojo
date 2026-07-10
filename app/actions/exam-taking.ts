"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { correctionAccessFromGrants, userCanViewQuizCorrections } from "@/lib/quiz-corrections-access";
import type { QuizQuestion } from "@prisma/client";

/** Robust answer resolution - handles option1, A, option 1, etc. Same logic as quizzes.ts */
function getOrderedOptionKeys(options: Record<string, string>) {
  const optionKeys = Object.keys(options || {});
  return optionKeys.slice().sort((a, b) => {
    const aNum = Number.parseInt(a.replace(/\D/g, ""), 10);
    const bNum = Number.parseInt(b.replace(/\D/g, ""), 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });
}

function resolveAnswerIndex(answer: string | undefined, options: Record<string, string>): number | null {
  if (!answer) return null;
  const trimmed = answer.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const orderedKeys = getOrderedOptionKeys(options);

  const directKey = orderedKeys.find((key) => key.toLowerCase() === lower);
  if (directKey) return orderedKeys.indexOf(directKey);

  const valueMatchKey = orderedKeys.find((key) => {
    const value = options[key];
    return value && value.trim().toLowerCase() === lower;
  });
  if (valueMatchKey) return orderedKeys.indexOf(valueMatchKey);

  const letterMatch = lower.match(/^([a-d])\s*[\).:\-]?/);
  if (letterMatch) {
    const idx = ["a", "b", "c", "d"].indexOf(letterMatch[1]);
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  const numberMatch = lower.match(/^([1-4])\s*[\).:\-]?/);
  if (numberMatch) {
    const idx = Number.parseInt(numberMatch[1], 10) - 1;
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  const optionMatch = lower.match(/^option\s*([1-9]\d*)/);
  if (optionMatch) {
    const idx = Number.parseInt(optionMatch[1], 10) - 1;
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  return null;
}

function mapQuestionsForCorrectionsReview(questions: QuizQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options as Record<string, string>,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
  }));
}

export type ExamTakingResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/** Treat as a finished mock exam row (avoids showing abandoned in-progress rows that also use score 0). */
function isSubmittedMockAttempt(attempt: { score: number; answers: unknown }, questionCount: number): boolean {
  const ans = attempt.answers;
  const keys =
    ans && typeof ans === "object" && !Array.isArray(ans)
      ? Object.keys(ans as Record<string, unknown>)
      : [];
  return attempt.score > 0 || keys.length >= questionCount;
}

/**
 * Get all available mock exams for a course
 */
export async function getAvailableExamsAction(courseId: string) {
  try {
    const user = await requireAuth();

    const exams = await prisma.quiz.findMany({
      where: {
        courseId,
        isMockExam: true,
      },
      include: {
        contentItem: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            question: true,
            options: true,
            type: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const examIds = exams.map((e) => e.id);

    const [allAttempts, grants] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          userId: user.id,
          quizId: { in: examIds },
        },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          quizId: true,
          score: true,
          completedAt: true,
          answers: true,
        },
      }),
      prisma.quizCorrectionsGrant.findMany({
        where: {
          userId: user.id,
          quizId: { in: examIds },
          revokedAt: null,
        },
        select: { quizId: true, attemptId: true },
      }),
    ]);

    const attemptsByQuiz = new Map<string, typeof allAttempts>();
    for (const attempt of allAttempts) {
      const list = attemptsByQuiz.get(attempt.quizId) ?? [];
      list.push(attempt);
      attemptsByQuiz.set(attempt.quizId, list);
    }

    const examsWithAttempts = exams.map((exam) => {
      const bucket = attemptsByQuiz.get(exam.id) ?? [];
      const questionCount = exam._count.questions;
      const submitted = bucket.filter((a) => isSubmittedMockAttempt(a, questionCount));
      const latestAttempt = submitted[0] ?? null;

      return {
        ...exam,
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              score: latestAttempt.score,
              completedAt: latestAttempt.completedAt,
            }
          : null,
        attemptCount: submitted.length,
        submittedAttempts: submitted.map((a) => ({
          id: a.id,
          score: a.score,
          completedAt: a.completedAt,
          passed: a.score >= exam.passingScore,
          canViewCorrections: correctionAccessFromGrants(
            grants,
            exam.id,
            a.id,
            a.score,
            exam.passingScore
          ),
        })),
      };
    });

    return {
      success: true,
      data: examsWithAttempts,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get available exams: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement des examens",
    };
  }
}

/**
 * Get exam with all questions (for taking the exam)
 */
export async function getExamForTakingAction(examId: string) {
  try {
    const user = await requireAuth();

    const exam = await prisma.quiz.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!exam || !exam.isMockExam) {
      return {
        success: false,
        error: "Examen introuvable",
      };
    }

    // Get user's in-progress attempt if exists (score is 0 means in-progress)
    const inProgressAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId: user.id,
        quizId: examId,
        score: 0, // Score of 0 indicates in-progress
      },
      orderBy: { completedAt: "desc" },
    });

    return {
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          timeLimit: exam.timeLimit,
          passingScore: exam.passingScore,
          examFormat: exam.examFormat,
          questions: exam.questions.map((q) => ({
            id: q.id,
            order: q.order,
            question: q.question,
            options: q.options,
            type: q.type,
          })),
        },
        inProgressAttempt: inProgressAttempt
          ? {
              id: inProgressAttempt.id,
              answers: inProgressAttempt.answers,
              timeSpent: inProgressAttempt.timeSpent,
            }
          : null,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get exam for taking: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement de l'examen",
    };
  }
}

/**
 * Save exam answers (auto-save during exam)
 */
export async function saveExamAnswersAction(
  examId: string,
  answers: Record<string, string>,
  timeSpent: number
): Promise<ExamTakingResult> {
  try {
    const user = await requireAuth();

    // Check if there's an in-progress attempt
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId: user.id,
        quizId: examId,
      },
      orderBy: { completedAt: "desc" },
    });

    if (existingAttempt && existingAttempt.score === 0) {
      // Update existing in-progress attempt
      await prisma.quizAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          answers,
          timeSpent,
        },
      });
    } else {
      // Create new attempt (in progress, no score yet)
      await prisma.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: examId,
          answers,
          timeSpent,
          score: 0, // Will be calculated on submission
        },
      });
    }

    return {
      success: true,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to save exam answers: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la sauvegarde",
    };
  }
}

/**
 * Submit exam (calculate score and finalize)
 */
export async function submitExamAction(
  examId: string,
  answers: Record<string, string>,
  timeSpent: number
): Promise<ExamTakingResult> {
  try {
    const user = await requireAuth();

    // Get exam with questions
    const exam = await prisma.quiz.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!exam || !exam.isMockExam) {
      return {
        success: false,
        error: "Examen introuvable",
      };
    }

    // Calculate score using robust answer resolution (handles option1, A, option 1, etc.)
    let correctAnswers = 0;
    const totalQuestions = exam.questions.length;

    exam.questions.forEach((question) => {
      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;
      if (!correctAnswer || typeof correctAnswer !== "string" || !correctAnswer.trim()) {
        return; // Skip questions with invalid correctAnswer to avoid errors
      }
      if (!userAnswer) return;

      if (question.type === "MULTIPLE_CHOICE") {
        const options = (question.options as Record<string, string>) || {};
        const userIndex = resolveAnswerIndex(userAnswer, options);
        const correctIndex = resolveAnswerIndex(correctAnswer, options);
        if (userIndex !== null && correctIndex !== null && userIndex === correctIndex) {
          correctAnswers++;
        }
      } else {
        // For other types, direct comparison
        if (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
          correctAnswers++;
        }
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Find or create attempt
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId: user.id,
        quizId: examId,
      },
      orderBy: { completedAt: "desc" },
    });

    let attempt;
    if (existingAttempt && existingAttempt.score === 0) {
      // Update existing in-progress attempt
      attempt = await prisma.quizAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          score,
          answers,
          timeSpent,
          completedAt: new Date(),
        },
      });
    } else {
      // Create new attempt
      attempt = await prisma.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: examId,
          score,
          answers,
          timeSpent,
          completedAt: new Date(),
        },
      });
    }

    const passed = score >= exam.passingScore;
    const canViewCorrections = await userCanViewQuizCorrections({
      userId: user.id,
      quizId: exam.id,
      attemptId: attempt.id,
      score,
      passingScore: exam.passingScore,
    });

    return {
      success: true,
      data: {
        attemptId: attempt.id,
        score,
        passingScore: exam.passingScore,
        passed,
        correctAnswers,
        totalQuestions,
        userAnswers: answers,
        canViewCorrections,
        ...(canViewCorrections && {
          questions: mapQuestionsForCorrectionsReview(exam.questions),
        }),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to submit exam: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Erreur lors de la soumission de l'examen",
    };
  }
}

/**
 * Load per-question corrections for a completed mock exam attempt (authorized users only).
 */
export async function getExamCorrectionsAction(attemptId: string): Promise<ExamTakingResult> {
  try {
    const user = await requireAuth();

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!attempt || attempt.userId !== user.id || !attempt.quiz.isMockExam) {
      return {
        success: false,
        error: "Tentative introuvable",
      };
    }

    const canViewCorrections = await userCanViewQuizCorrections({
      userId: user.id,
      quizId: attempt.quizId,
      attemptId: attempt.id,
      score: attempt.score,
      passingScore: attempt.quiz.passingScore,
    });

    if (!canViewCorrections) {
      return {
        success: false,
        error: "Accès aux corrections non autorisé",
      };
    }

    return {
      success: true,
      data: {
        questions: mapQuestionsForCorrectionsReview(attempt.quiz.questions),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get exam corrections: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement des corrections",
    };
  }
}

/**
 * Review a past mock exam attempt on the exam list (user answers; correct answers only if allowed).
 */
export async function getMockExamAttemptReviewAction(attemptId: string): Promise<ExamTakingResult> {
  try {
    const user = await requireAuth();

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!attempt || attempt.userId !== user.id || !attempt.quiz.isMockExam) {
      return {
        success: false,
        error: "Tentative introuvable",
      };
    }

    const questionCount = attempt.quiz.questions.length;
    if (!isSubmittedMockAttempt(attempt, questionCount)) {
      return {
        success: false,
        error: "Tentative non terminée",
      };
    }

    const canViewCorrections = await userCanViewQuizCorrections({
      userId: user.id,
      quizId: attempt.quizId,
      attemptId: attempt.id,
      score: attempt.score,
      passingScore: attempt.quiz.passingScore,
    });

    const userAnswers =
      attempt.answers && typeof attempt.answers === "object" && !Array.isArray(attempt.answers)
        ? (attempt.answers as Record<string, string>)
        : {};

    const toOpts = (raw: unknown): Record<string, string> => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const o = raw as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) {
        if (v == null) continue;
        out[k] = typeof v === "string" ? v : String(v);
      }
      return out;
    };

    const questions = attempt.quiz.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: toOpts(q.options),
      correctAnswer: canViewCorrections ? q.correctAnswer : "",
      explanation: canViewCorrections ? q.explanation ?? null : null,
    }));

    return {
      success: true,
      data: {
        score: attempt.score,
        passingScore: attempt.quiz.passingScore,
        passed: attempt.score >= attempt.quiz.passingScore,
        canViewCorrections,
        userAnswers,
        questions,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `getMockExamAttemptReviewAction: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement de la tentative",
    };
  }
}

/**
 * Get exam attempt results (correct answers omitted unless the user may review corrections).
 */
export async function getExamAttemptAction(attemptId: string) {
  try {
    const user = await requireAuth();

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!attempt || attempt.userId !== user.id) {
      return {
        success: false,
        error: "Tentative introuvable",
      };
    }

    const canViewCorrections = await userCanViewQuizCorrections({
      userId: user.id,
      quizId: attempt.quizId,
      attemptId: attempt.id,
      score: attempt.score,
      passingScore: attempt.quiz.passingScore,
    });

    const questions = attempt.quiz.questions.map((q) => ({
      ...q,
      correctAnswer: canViewCorrections ? q.correctAnswer : "",
      explanation: canViewCorrections ? q.explanation : null,
    }));

    return {
      success: true,
      data: {
        ...attempt,
        quiz: {
          ...attempt.quiz,
          questions,
        },
        canViewCorrections,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get exam attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement de la tentative",
    };
  }
}

