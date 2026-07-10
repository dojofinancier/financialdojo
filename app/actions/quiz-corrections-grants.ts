"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

const grantSchema = z.object({
  studentUserId: z.string().uuid(),
  quizId: z.string().uuid(),
  attemptId: z.string().uuid().optional().nullable(),
});

const revokeSchema = z.object({
  grantId: z.string().uuid(),
});

export async function grantQuizCorrectionsAccessAction(
  raw: z.infer<typeof grantSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const admin = await requireAdmin();
    const data = grantSchema.parse(raw);

    const quiz = await prisma.quiz.findUnique({
      where: { id: data.quizId },
      select: { id: true, isMockExam: true },
    });

    if (!quiz) {
      return { success: false, error: "Quiz not found" };
    }

    if (!quiz.isMockExam) {
      return { success: false, error: "Grants apply to mock exams only" };
    }

    if (data.attemptId) {
      const attempt = await prisma.quizAttempt.findFirst({
        where: {
          id: data.attemptId,
          userId: data.studentUserId,
          quizId: data.quizId,
        },
        select: { id: true },
      });

      if (!attempt) {
        return { success: false, error: "Attempt not found for this student and exam" };
      }

      await prisma.quizCorrectionsGrant.updateMany({
        where: {
          userId: data.studentUserId,
          quizId: data.quizId,
          attemptId: data.attemptId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await prisma.quizCorrectionsGrant.create({
        data: {
          userId: data.studentUserId,
          quizId: data.quizId,
          attemptId: data.attemptId,
          grantedByUserId: admin.id,
        },
      });
    } else {
      await prisma.quizCorrectionsGrant.updateMany({
        where: {
          userId: data.studentUserId,
          quizId: data.quizId,
          attemptId: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await prisma.quizCorrectionsGrant.create({
        data: {
          userId: data.studentUserId,
          quizId: data.quizId,
          attemptId: null,
          grantedByUserId: admin.id,
        },
      });
    }

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `grantQuizCorrectionsAccessAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false, error: "Unable to grant corrections access" };
  }
}

export async function revokeQuizCorrectionsGrantAction(
  raw: z.infer<typeof revokeSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const { grantId } = revokeSchema.parse(raw);

    const grant = await prisma.quizCorrectionsGrant.findUnique({
      where: { id: grantId },
      select: { id: true, revokedAt: true },
    });

    if (!grant) {
      return { success: false, error: "Grant not found" };
    }

    if (grant.revokedAt) {
      return { success: false, error: "Already revoked" };
    }

    await prisma.quizCorrectionsGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `revokeQuizCorrectionsGrantAction: ${error instanceof Error ? error.message : "Unknown"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false, error: "Unable to revoke access" };
  }
}
