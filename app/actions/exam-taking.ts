"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

export type ExamTakingResult = {
  success: boolean;
  error?: string;
  data?: any;
};

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

    // Batch load all attempts for all exams in a single query
    const examIds = exams.map((e) => e.id);
    const allAttempts = await prisma.quizAttempt.findMany({
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
      },
    });

    // Get attempt counts in a single aggregation query
    const attemptCounts = await prisma.quizAttempt.groupBy({
      by: ["quizId"],
      where: {
        userId: user.id,
        quizId: { in: examIds },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map(attemptCounts.map((c) => [c.quizId, c._count.id]));

    // Group attempts by quizId and get most recent for each
    const attemptsByQuiz = new Map<string, typeof allAttempts[0]>();
    for (const attempt of allAttempts) {
      if (!attemptsByQuiz.has(attempt.quizId)) {
        attemptsByQuiz.set(attempt.quizId, attempt);
      }
    }

    // Combine exam data with attempts
    const examsWithAttempts = exams.map((exam) => ({
      ...exam,
      latestAttempt: attemptsByQuiz.get(exam.id) || null,
      attemptCount: countMap.get(exam.id) || 0,
    }));

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
      error: "Error loading exams",
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
      error: "Error loading the exam",
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
      error: "Error saving",
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

    if (!exam) {
      return {
        success: false,
        error: "Examen introuvable",
      };
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = exam.questions.length;

    exam.questions.forEach((question) => {
      const userAnswer = answers[question.id];
      if (userAnswer) {
        // For MCQ, compare with correctAnswer
        if (question.type === "MULTIPLE_CHOICE") {
          // Handle both "option1" format and direct answer format
          const normalizedUserAnswer = userAnswer.trim().toLowerCase();
          const normalizedCorrectAnswer = question.correctAnswer.trim().toLowerCase();
          
          if (normalizedUserAnswer === normalizedCorrectAnswer) {
            correctAnswers++;
          }
        } else {
          // For other types, direct comparison
          if (userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()) {
            correctAnswers++;
          }
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

    return {
      success: true,
      data: {
        attempt,
        score,
        passingScore: exam.passingScore,
        passed: score >= exam.passingScore,
        correctAnswers,
        totalQuestions,
        userAnswers: answers, // Include user's answers
        questions: exam.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
        })),
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
      error: "Error submitting the exam",
    };
  }
}

/**
 * Get exam attempt results
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

    return {
      success: true,
      data: attempt,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get exam attempt: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading the attempt",
    };
  }
}

