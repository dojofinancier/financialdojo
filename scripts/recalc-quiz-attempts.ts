/**
 * Recalculate stored quiz attempt scores using robust answer matching.
 *
 * Usage:
 *   npx tsx scripts/recalc-quiz-attempts.ts <quizId>
 *   npx tsx scripts/recalc-quiz-attempts.ts --all
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { isAnswerCorrect } from "../lib/utils/quiz-answer-display";

const prisma = new PrismaClient();

type RecalcResult = {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  updatedCount: number;
};

async function recalcQuizAttempts(quizId: string): Promise<RecalcResult | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!quiz) {
    return null;
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
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
    quizId,
    quizTitle: quiz.title,
    totalAttempts: attempts.length,
    updatedCount,
  };
}

async function recalcAllQuizAttempts() {
  const quizzes = await prisma.quiz.findMany({
    where: {
      attempts: {
        some: {},
      },
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: "asc" },
  });

  if (quizzes.length === 0) {
    console.log("No quizzes with attempts found.");
    return;
  }

  console.log(`Recalculating attempts for ${quizzes.length} quiz(zes)...\n`);

  let totalAttempts = 0;
  let totalUpdated = 0;
  let quizzesWithUpdates = 0;

  for (const quiz of quizzes) {
    const result = await recalcQuizAttempts(quiz.id);
    if (!result) continue;

    totalAttempts += result.totalAttempts;
    totalUpdated += result.updatedCount;
    if (result.updatedCount > 0) {
      quizzesWithUpdates++;
    }

    const marker = result.updatedCount > 0 ? "*" : " ";
    console.log(
      `${marker} ${result.quizTitle} (${result.quizId}): ${result.totalAttempts} attempts, ${result.updatedCount} updated`
    );
  }

  console.log("\n--- Summary ---");
  console.log(`Quizzes processed: ${quizzes.length}`);
  console.log(`Quizzes with score changes: ${quizzesWithUpdates}`);
  console.log(`Total attempts: ${totalAttempts}`);
  console.log(`Attempts updated: ${totalUpdated}`);
}

const arg = process.argv[2];

if (!arg) {
  console.error("Usage:");
  console.error("  npx tsx scripts/recalc-quiz-attempts.ts <quizId>");
  console.error("  npx tsx scripts/recalc-quiz-attempts.ts --all");
  process.exit(1);
}

const run = async () => {
  if (arg === "--all") {
    await recalcAllQuizAttempts();
    return;
  }

  const result = await recalcQuizAttempts(arg);
  if (!result) {
    console.error(`Quiz not found: ${arg}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Recalculated ${result.totalAttempts} attempts for "${result.quizTitle}" (${result.quizId}). Updated: ${result.updatedCount}.`
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
