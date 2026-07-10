"use server";

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

const submitQuizSchema = z.object({
  quizId: z.string(),
  answers: z.record(z.string(), z.string()),
  timeSpent: z.number().optional(),
  quizSequence: z.number().int().min(1).max(3).optional(),
  moduleId: z.string().optional(),
});

const recalcQuizAttemptsSchema = z.object({
  quizId: z.string(),
});

export type QuizActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function submitQuizAttemptAction(
  data: z.infer<typeof submitQuizSchema>
): Promise<QuizActionResult> {
  try {
    await requireAuth();
    const validatedData = submitQuizSchema.parse(data);
    const { submitModuleQuizAttemptAction } = await import("@/app/actions/module-quiz");
    return submitModuleQuizAttemptAction({
      quizId: validatedData.quizId,
      answers: validatedData.answers,
      timeSpent: validatedData.timeSpent,
      quizSequence: validatedData.quizSequence,
      moduleId: validatedData.moduleId,
    });
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

export async function recalcQuizAttemptsAction(
  data: z.infer<typeof recalcQuizAttemptsSchema>
): Promise<QuizActionResult> {
  try {
    await requireAdmin();
    const validatedData = recalcQuizAttemptsSchema.parse(data);
    const { prisma } = await import("@/lib/prisma");
    const { isAnswerCorrect } = await import("@/lib/utils/quiz-answer-display");

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
        error: "Quiz not found",
      };
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: validatedData.quizId },
      select: {
        id: true,
        score: true,
        answers: true,
      },
    });

    const totalQuestions = quiz.questions.length;
    let updatedCount = 0;

    for (const attempt of attempts) {
      const answers = (attempt.answers as Record<string, string>) || {};
      let correctAnswers = 0;

      quiz.questions.forEach((question) => {
        if (isAnswerCorrect(question, answers[question.id])) {
          correctAnswers++;
        }
      });

      const score =
        totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      if (score !== attempt.score) {
        await prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { score },
        });
        updatedCount++;
      }
    }

    return {
      success: true,
      data: {
        totalAttempts: attempts.length,
        updatedCount,
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
      errorMessage: `Failed to recalc quiz attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error recalculating quiz attempts",
    };
  }
}

export async function getQuizAttemptsAction(quizId: string) {
  try {
    await requireAuth();
    const { getModuleQuizAttemptsAction } = await import("@/app/actions/module-quiz");
    return getModuleQuizAttemptsAction(quizId);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get quiz attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}
