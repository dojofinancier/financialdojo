"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";

const submitQuizSchema = z.object({
  quizId: z.string(),
  answers: z.record(z.string(), z.string()), // { questionId: answer }
  timeSpent: z.number().optional(),
});

export type QuizActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Submit a quiz attempt
 */
export async function submitQuizAttemptAction(
  data: z.infer<typeof submitQuizSchema>
): Promise<QuizActionResult> {
  try {
    const user = await requireAuth();
    const validatedData = submitQuizSchema.parse(data);

    // Get quiz with questions
    const quiz = await prisma.quiz.findUnique({
      where: { id: validatedData.quizId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!quiz) {
      return {
        success: false,
        error: "Quiz introuvable",
      };
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question) => {
      const userAnswer = validatedData.answers[question.id];
      if (userAnswer && userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / totalQuestions) * 100);

    // Create quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizId: validatedData.quizId,
        score,
        answers: validatedData.answers,
        timeSpent: validatedData.timeSpent,
      },
    });

    // Mark content item as complete if passing score achieved
    if (score >= quiz.passingScore) {
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: quiz.contentItemId },
      });

      if (contentItem) {
        await prisma.progressTracking.upsert({
          where: {
            userId_contentItemId: {
              userId: user.id,
              contentItemId: contentItem.id,
            },
          },
          create: {
            userId: user.id,
            contentItemId: contentItem.id,
            completedAt: new Date(),
            lastAccessedAt: new Date(),
          },
          update: {
            completedAt: new Date(),
            lastAccessedAt: new Date(),
          },
        });
      }
    }

    return {
      success: true,
      data: {
        attempt,
        score,
        passingScore: quiz.passingScore,
        passed: score >= quiz.passingScore,
        correctAnswers,
        totalQuestions,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to submit quiz attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error submitting the quiz",
    };
  }
}

/**
 * Get quiz attempts for a quiz
 */
export async function getQuizAttemptsAction(quizId: string) {
  try {
    const user = await requireAuth();

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        userId: user.id,
      },
      orderBy: { completedAt: "desc" },
    });

    return attempts;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get quiz attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}

