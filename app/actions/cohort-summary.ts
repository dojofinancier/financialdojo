"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

export type CohortSummaryData = {
  cohortId: string;
  nextSession: {
    id: string;
    title: string;
    scheduledAt: Date;
    zoomLink: string | null;
    teamsLink: string | null;
  } | null;
  unreadMessageCount: number;
  totalSessions: number;
  completedSessions: number;
};

/**
 * Get summary data for a cohort (upcoming sessions, unread messages, etc.)
 */
export async function getCohortSummaryAction(
  cohortId: string
): Promise<{ success: boolean; data?: CohortSummaryData; error?: string }> {
  try {
    const user = await requireAuth();

    // Check if user has access to the cohort
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const isAdminOrInstructor = user.role === "ADMIN" || user.role === "INSTRUCTOR";

    if (!enrollment && !isAdminOrInstructor) {
      return {
        success: false,
        error: "You do not have access to this cohort",
      };
    }

    // Get next upcoming session
    const nextSession = await prisma.groupCoachingSession.findFirst({
      where: {
        cohortId,
        status: "UPCOMING",
        scheduledAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        zoomLink: true,
        teamsLink: true,
      },
    });

    // Get unread message count
    const allMessages = await prisma.cohortMessage.findMany({
      where: { cohortId },
      select: { id: true },
    });

    const messageIds = allMessages.map((m) => m.id);
    let unreadCount = 0;

    if (messageIds.length > 0) {
      const readMessages = await prisma.cohortMessageRead.findMany({
        where: {
          userId: user.id,
          cohortMessageId: {
            in: messageIds,
          },
        },
        select: {
          cohortMessageId: true,
        },
      });

      const readMessageIds = new Set(readMessages.map((r) => r.cohortMessageId));
      unreadCount = messageIds.filter((id) => !readMessageIds.has(id)).length;
    }

    // Get session counts
    const [totalSessions, completedSessions] = await Promise.all([
      prisma.groupCoachingSession.count({
        where: { cohortId },
      }),
      prisma.groupCoachingSession.count({
        where: {
          cohortId,
          status: "COMPLETED",
        },
      }),
    ]);

    return {
      success: true,
      data: {
        cohortId,
        nextSession: nextSession
          ? {
              id: nextSession.id,
              title: nextSession.title,
              scheduledAt: nextSession.scheduledAt,
              zoomLink: nextSession.zoomLink,
              teamsLink: nextSession.teamsLink,
            }
          : null,
        unreadMessageCount: unreadCount,
        totalSessions,
        completedSessions,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving the cohort information",
    };
  }
}

/**
 * Get summary data for multiple cohorts
 */
export async function getCohortsSummaryAction(
  cohortIds: string[]
): Promise<{ success: boolean; data?: Record<string, CohortSummaryData>; error?: string }> {
  try {
    const summaries = await Promise.all(
      cohortIds.map((id) => getCohortSummaryAction(id))
    );

    const result: Record<string, CohortSummaryData> = {};
    summaries.forEach((summary, index) => {
      if (summary.success && summary.data) {
        result[cohortIds[index]] = summary.data;
      }
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohorts summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving cohorts information",
    };
  }
}

