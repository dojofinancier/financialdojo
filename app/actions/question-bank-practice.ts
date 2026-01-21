"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

export type QuestionBankPracticeResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all questions from all question banks for a course (randomized)
 */
export async function getQuestionBankQuestionsAction(courseId: string) {
  try {
    const user = await requireAuth();

    // Get all question banks for the course
    const questionBanks = await prisma.questionBank.findMany({
      where: { courseId },
      include: {
        questions: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    // Flatten all questions from all banks
    const allQuestions = questionBanks.flatMap((bank) =>
      bank.questions.map((q) => ({
        ...q,
        questionBankId: bank.id,
        questionBankTitle: bank.title,
      }))
    );

    // Shuffle questions randomly
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);

    return {
      success: true,
      data: shuffled,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get question bank questions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading questions",
    };
  }
}

/**
 * Submit an answer to a question bank question
 */
export async function submitQuestionBankAnswerAction(
  questionBankId: string,
  questionId: string,
  answer: string,
  timeSpent?: number
): Promise<QuestionBankPracticeResult> {
  try {
    const user = await requireAuth();

    // Get the question to check the correct answer
    const question = await prisma.questionBankQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return {
        success: false,
        error: "Question introuvable",
      };
    }

    // Check if answer is correct (normalize comparison)
    const isCorrect =
      answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

    // Create attempt record
    const attempt = await prisma.questionBankAttempt.create({
      data: {
        userId: user.id,
        questionBankId,
        questionId,
        answer,
        isCorrect,
        timeSpent,
      },
    });

    return {
      success: true,
      data: {
        attempt,
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to submit question bank answer: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error submitting the answer",
    };
  }
}

/**
 * Get most recent attempts for questions in a course (optimized with single query)
 */
export async function getQuestionBankAttemptsAction(courseId: string) {
  try {
    const user = await requireAuth();

    // Get all question banks for the course
    const questionBanks = await prisma.questionBank.findMany({
      where: { courseId },
      select: { id: true },
    });

    const bankIds = questionBanks.map((b) => b.id);

    if (bankIds.length === 0) {
      return {
        success: true,
        data: {},
      };
    }

    // Get all questions from these banks
    const questions = await prisma.questionBankQuestion.findMany({
      where: {
        questionBankId: { in: bankIds },
      },
      select: { id: true },
    });

    const questionIds = questions.map((q) => q.id);

    if (questionIds.length === 0) {
      return {
        success: true,
        data: {},
      };
    }

    // Get all attempts, then group by questionId to get most recent
    const allAttempts = await prisma.questionBankAttempt.findMany({
      where: {
        userId: user.id,
        questionId: { in: questionIds },
      },
      orderBy: { completedAt: "desc" },
      select: {
        questionId: true,
        answer: true,
        isCorrect: true,
      },
    });

    // Group by questionId and get the most recent for each (already sorted by completedAt desc)
    const attemptsMap: Record<string, { answer: string; isCorrect: boolean; submitted: boolean }> = {};
    
    for (const attempt of allAttempts) {
      if (!attemptsMap[attempt.questionId]) {
        attemptsMap[attempt.questionId] = {
          answer: attempt.answer,
          isCorrect: attempt.isCorrect,
          submitted: true,
        };
      }
    }

    return {
      success: true,
      data: attemptsMap,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get question bank attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while loading attempts",
    };
  }
}

/**
 * Get statistics for question bank practice
 */
export async function getQuestionBankStatsAction(courseId: string) {
  try {
    const user = await requireAuth();

    // Get all question banks for the course
    const questionBanks = await prisma.questionBank.findMany({
      where: { courseId },
      select: { id: true },
    });

    const bankIds = questionBanks.map((b) => b.id);

    if (bankIds.length === 0) {
      return {
        success: true,
        data: {
          totalAttempts: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          totalQuestions: 0,
          score: 0,
        },
      };
    }

    // Get all attempts for this user in these question banks
    const attempts = await prisma.questionBankAttempt.findMany({
      where: {
        userId: user.id,
        questionBankId: { in: bankIds },
      },
    });

    const totalAttempts = attempts.length;
    const correctAnswers = attempts.filter((a) => a.isCorrect).length;
    const incorrectAnswers = totalAttempts - correctAnswers;
    const score = totalAttempts > 0 ? Math.round((correctAnswers / totalAttempts) * 100) : 0;

    // Get total questions available
    const totalQuestions = await prisma.questionBankQuestion.count({
      where: {
        questionBankId: { in: bankIds },
      },
    });

    return {
      success: true,
      data: {
        totalAttempts,
        correctAnswers,
        incorrectAnswers,
        totalQuestions,
        score,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get question bank stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading statistics",
    };
  }
}

