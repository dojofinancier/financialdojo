import { prisma } from "@/lib/prisma";

export type QuizCorrectionsGrantCheck = {
  userId: string;
  quizId: string;
  attemptId: string;
  score: number;
  passingScore: number;
};

/**
 * Returns true if the user may see correct answers / explanations for this quiz attempt
 * (passed, or an active manual grant covers this attempt or all attempts for the quiz).
 */
export async function userCanViewQuizCorrections(
  params: QuizCorrectionsGrantCheck
): Promise<boolean> {
  if (params.score >= params.passingScore) {
    return true;
  }

  const grant = await prisma.quizCorrectionsGrant.findFirst({
    where: {
      userId: params.userId,
      quizId: params.quizId,
      revokedAt: null,
      OR: [{ attemptId: null }, { attemptId: params.attemptId }],
    },
  });

  return !!grant;
}

export function findActiveGrantForAttempt(
  grants: Array<{ id: string; quizId: string; attemptId: string | null }>,
  quizId: string,
  attemptId: string
): { id: string } | null {
  const match = grants.find(
    (g) => g.quizId === quizId && (g.attemptId === null || g.attemptId === attemptId)
  );
  return match ? { id: match.id } : null;
}

/** In-memory check using preloaded active grants (same rules as userCanViewQuizCorrections). */
export function correctionAccessFromGrants(
  grants: Array<{ quizId: string; attemptId: string | null }>,
  quizId: string,
  attemptId: string,
  score: number,
  passingScore: number
): boolean {
  if (score >= passingScore) return true;
  return grants.some(
    (g) => g.quizId === quizId && (g.attemptId === null || g.attemptId === attemptId)
  );
}
