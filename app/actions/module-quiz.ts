"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import {
  SUPPLEMENTARY_QUIZ_MIN_POOL,
  SUPPLEMENTARY_QUIZ_QUESTION_COUNT,
  type QuizQuestionSnapshotItem,
  toPublicSnapshot,
} from "@/lib/types/module-quiz";
import { resolveAnswerIndex } from "@/lib/utils/quiz-answer-display";

export type ModuleQuizActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scoreSnapshotAnswers(
  questions: QuizQuestionSnapshotItem[],
  answers: Record<string, string>
): { score: number; correctAnswers: number; totalQuestions: number } {
  let correctAnswers = 0;
  const totalQuestions = questions.length;
  for (const question of questions) {
    const options = question.options || {};
    const userIndex = resolveAnswerIndex(answers[question.id], options);
    const correctIndex = resolveAnswerIndex(question.correctAnswer, options);
    if (userIndex !== null && correctIndex !== null && userIndex === correctIndex) {
      correctAnswers++;
    }
  }
  const score =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  return { score, correctAnswers, totalQuestions };
}

async function getModuleBankQuestions(moduleId: string) {
  return prisma.questionBankQuestion.findMany({
    where: {
      questionBank: { moduleId },
    },
    orderBy: [{ questionBankId: "asc" }, { order: "asc" }],
  });
}

function buildSnapshotFromBankQuestions(
  bankQuestions: Awaited<ReturnType<typeof getModuleBankQuestions>>
): QuizQuestionSnapshotItem[] {
  const picked = shuffle(bankQuestions).slice(0, SUPPLEMENTARY_QUIZ_QUESTION_COUNT);
  return picked.map((q, index) => ({
    id: q.id,
    order: index + 1,
    question: q.question,
    options: (q.options as Record<string, string>) || {},
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));
}

function bestScoreForSequence(
  attempts: { quizSequence: number; score: number }[],
  sequence: number
): number {
  return attempts
    .filter((a) => a.quizSequence === sequence)
    .reduce((max, a) => Math.max(max, a.score), 0);
}

function hasUnlockedSequence(
  attempts: { quizSequence: number; score: number }[],
  sequence: number,
  passingScore: number
): boolean {
  if (sequence === 2) {
    return bestScoreForSequence(attempts, 1) >= passingScore;
  }
  if (sequence === 3) {
    return bestScoreForSequence(attempts, 2) >= passingScore;
  }
  return true;
}

export async function getModuleQuizProgressAction(
  moduleId: string,
  quizId: string
): Promise<ModuleQuizActionResult> {
  try {
    const user = await requireAuth();

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, passingScore: true, isMockExam: true },
    });

    if (!quiz || quiz.isMockExam) {
      return { success: false, error: "Quiz not found" };
    }

    const bankQuestions = await getModuleBankQuestions(moduleId);
    const bankPoolSize = bankQuestions.length;
    const supplementaryAvailable = bankPoolSize >= SUPPLEMENTARY_QUIZ_MIN_POOL;

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id, quizId },
      select: { quizSequence: true, score: true },
    });

    const passingScore = quiz.passingScore;
    const unlockedQuiz2 =
      supplementaryAvailable && hasUnlockedSequence(attempts, 2, passingScore);
    const unlockedQuiz3 =
      supplementaryAvailable && hasUnlockedSequence(attempts, 3, passingScore);

    const supplementarySets = await prisma.quizSupplementaryQuestionSet.findMany({
      where: { userId: user.id, quizId },
      select: { quizSequence: true },
    });

    return {
      success: true,
      data: {
        passingScore,
        bankPoolSize,
        supplementaryAvailable,
        unlockedQuiz2,
        unlockedQuiz3,
        bestScoreQuiz1: bestScoreForSequence(attempts, 1),
        bestScoreQuiz2: bestScoreForSequence(attempts, 2),
        bestScoreQuiz3: bestScoreForSequence(attempts, 3),
        hasQuiz2Set: supplementarySets.some((s) => s.quizSequence === 2),
        hasQuiz3Set: supplementarySets.some((s) => s.quizSequence === 3),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `getModuleQuizProgressAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false, error: "Failed to load quiz progress" };
  }
}

export async function startSupplementaryQuizAction(
  moduleId: string,
  quizId: string,
  quizSequence: 2 | 3
): Promise<ModuleQuizActionResult> {
  try {
    const user = await requireAuth();

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, passingScore: true, isMockExam: true },
    });

    if (!quiz || quiz.isMockExam) {
      return { success: false, error: "Quiz not found" };
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id, quizId },
      select: { quizSequence: true, score: true },
    });

    if (!hasUnlockedSequence(attempts, quizSequence, quiz.passingScore)) {
      return {
        success: false,
        error: `You must score at least ${quiz.passingScore}% on the previous quiz to continue.`,
      };
    }

    const existing = await prisma.quizSupplementaryQuestionSet.findUnique({
      where: {
        userId_quizId_quizSequence: {
          userId: user.id,
          quizId,
          quizSequence,
        },
      },
    });

    if (existing) {
      const snapshot = existing.questionsSnapshot as QuizQuestionSnapshotItem[];
      return {
        success: true,
        data: {
          quizSequence,
          questions: toPublicSnapshot(snapshot),
        },
      };
    }

    const bankQuestions = await getModuleBankQuestions(moduleId);
    if (bankQuestions.length < SUPPLEMENTARY_QUIZ_MIN_POOL) {
      return {
        success: false,
        error: `The chapter question bank must have at least ${SUPPLEMENTARY_QUIZ_MIN_POOL} questions.`,
      };
    }

    const snapshot = buildSnapshotFromBankQuestions(bankQuestions);

    await prisma.quizSupplementaryQuestionSet.create({
      data: {
        userId: user.id,
        quizId,
        quizSequence,
        questionsSnapshot: snapshot,
      },
    });

    return {
      success: true,
      data: {
        quizSequence,
        questions: toPublicSnapshot(snapshot),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `startSupplementaryQuizAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false, error: "Failed to start quiz" };
  }
}

export async function getModuleQuizAttemptsAction(quizId: string) {
  try {
    const user = await requireAuth();

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, userId: user.id },
      select: {
        id: true,
        score: true,
        completedAt: true,
        answers: true,
        quizSequence: true,
        questionsSnapshot: true,
      },
      orderBy: { completedAt: "desc" },
    });

    const bySequence = new Map<number, typeof attempts>();
    for (const attempt of attempts) {
      const seq = attempt.quizSequence;
      if (!bySequence.has(seq)) bySequence.set(seq, []);
      bySequence.get(seq)!.push(attempt);
    }

    const attemptNumberById = new Map<string, number>();
    for (const [, seqAttempts] of bySequence) {
      const chronological = [...seqAttempts].sort(
        (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
      );
      chronological.forEach((attempt, index) => {
        attemptNumberById.set(attempt.id, index + 1);
      });
    }

    return attempts.map((attempt) => {
      const seq = attempt.quizSequence;
      const attemptNumber = attemptNumberById.get(attempt.id) ?? 1;
      return {
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completedAt,
        answers: (attempt.answers as Record<string, string>) || {},
        quizSequence: seq,
        questionsSnapshot: attempt.questionsSnapshot as QuizQuestionSnapshotItem[] | null,
        label: `Quiz ${seq} · Attempt ${attemptNumber}`,
        attemptNumber,
      };
    });
  } catch (error) {
    await logServerError({
      errorMessage: `getModuleQuizAttemptsAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return [];
  }
}

export async function submitModuleQuizAttemptAction(data: {
  quizId: string;
  answers: Record<string, string>;
  quizSequence?: number;
  moduleId?: string;
  timeSpent?: number;
}): Promise<ModuleQuizActionResult> {
  try {
    const user = await requireAuth();
    const quizSequence = data.quizSequence ?? 1;

    if (quizSequence < 1 || quizSequence > 3) {
      return { success: false, error: "Invalid quiz sequence" };
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: data.quizId },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!quiz) {
      return { success: false, error: "Quiz not found" };
    }

    if (quizSequence === 1) {
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;

      quiz.questions.forEach((question) => {
        const options = (question.options as Record<string, string>) || {};
        const userIndex = resolveAnswerIndex(data.answers[question.id], options);
        const correctIndex = resolveAnswerIndex(question.correctAnswer, options);
        if (userIndex !== null && correctIndex !== null && userIndex === correctIndex) {
          correctAnswers++;
        }
      });

      const score =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0;

      const attempt = await prisma.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: data.quizId,
          quizSequence: 1,
          score,
          answers: data.answers,
          timeSpent: data.timeSpent,
        },
      });

      if (score >= quiz.passingScore) {
        await prisma.progressTracking.upsert({
          where: {
            userId_contentItemId: {
              userId: user.id,
              contentItemId: quiz.contentItemId,
            },
          },
          create: {
            userId: user.id,
            contentItemId: quiz.contentItemId,
            completedAt: new Date(),
            lastAccessedAt: new Date(),
          },
          update: {
            completedAt: new Date(),
            lastAccessedAt: new Date(),
          },
        });
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
          quizSequence: 1,
        },
      };
    }

    if (!data.moduleId) {
      return { success: false, error: "Module is required" };
    }

    const seq = quizSequence as 2 | 3;
    const questionSet = await prisma.quizSupplementaryQuestionSet.findUnique({
      where: {
        userId_quizId_quizSequence: {
          userId: user.id,
          quizId: data.quizId,
          quizSequence: seq,
        },
      },
    });

    if (!questionSet) {
      return {
        success: false,
        error: "Start the quiz before submitting your answers.",
      };
    }

    const snapshot = questionSet.questionsSnapshot as QuizQuestionSnapshotItem[];
    const allAnswered = snapshot.every((q) => data.answers[q.id]);
    if (!allAnswered) {
      return { success: false, error: "Please answer all questions" };
    }

    const { score, correctAnswers, totalQuestions } = scoreSnapshotAnswers(
      snapshot,
      data.answers
    );

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizId: data.quizId,
        quizSequence: seq,
        score,
        answers: data.answers,
        questionsSnapshot: snapshot,
        timeSpent: data.timeSpent,
      },
    });

    return {
      success: true,
      data: {
        attempt,
        score,
        passingScore: quiz.passingScore,
        passed: score >= quiz.passingScore,
        correctAnswers,
        totalQuestions,
        quizSequence: seq,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `submitModuleQuizAttemptAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false, error: "Failed to submit quiz" };
  }
}

export async function loadSupplementaryQuestionsForRetakeAction(
  quizId: string,
  quizSequence: 2 | 3
): Promise<ModuleQuizActionResult> {
  try {
    const user = await requireAuth();
    const set = await prisma.quizSupplementaryQuestionSet.findUnique({
      where: {
        userId_quizId_quizSequence: {
          userId: user.id,
          quizId,
          quizSequence,
        },
      },
    });

    if (!set) {
      return { success: false, error: "No question set found for this quiz." };
    }

    const snapshot = set.questionsSnapshot as QuizQuestionSnapshotItem[];
    return {
      success: true,
      data: {
        quizSequence,
        questions: toPublicSnapshot(snapshot),
      },
    };
  } catch (error) {
    return { success: false, error: "Failed to load quiz" };
  }
}
