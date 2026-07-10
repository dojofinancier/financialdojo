/**
 * One-time backfill: grant corrections access for existing failed mock-exam attempts
 * so students keep review access after the corrections-gate feature ships.
 *
 * Usage:
 *   npx tsx scripts/backfill-quiz-corrections-grants.ts
 *   npx tsx scripts/backfill-quiz-corrections-grants.ts --dry-run
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  if (!admin) {
    throw new Error("No ADMIN user found — create an admin before running backfill.");
  }

  console.log(`Using granter admin: ${admin.email} (${admin.id})`);
  if (dryRun) console.log("DRY RUN — no rows will be created.\n");

  const failedAttempts = await prisma.quizAttempt.findMany({
    where: {
      quiz: { isMockExam: true },
    },
    include: {
      quiz: { select: { passingScore: true, title: true } },
    },
  });

  const toGrant = failedAttempts.filter(
    (a) => a.score < a.quiz.passingScore
  );

  console.log(`Found ${toGrant.length} failed mock-exam attempts to evaluate.`);

  let created = 0;
  let skipped = 0;

  for (const attempt of toGrant) {
    const existing = await prisma.quizCorrectionsGrant.findFirst({
      where: {
        userId: attempt.userId,
        quizId: attempt.quizId,
        attemptId: attempt.id,
        revokedAt: null,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.quizCorrectionsGrant.create({
        data: {
          userId: attempt.userId,
          quizId: attempt.quizId,
          attemptId: attempt.id,
          grantedByUserId: admin.id,
        },
      });
    }
    created++;
  }

  console.log(
    dryRun
      ? `Would create ${created} grants (${skipped} already covered).`
      : `Created ${created} grants (${skipped} already covered).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
