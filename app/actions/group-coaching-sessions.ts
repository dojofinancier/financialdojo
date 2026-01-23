"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminOrInstructor, requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";

const groupCoachingSessionSchema = z.object({
  cohortId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  scheduledAt: z.date(),
  zoomLink: z.string().url().optional().nullable(),
  teamsLink: z.string().url().optional().nullable(),
  recordingVimeoUrl: z.string().url().optional().nullable(),
  adminNotes: z.string().optional(),
  status: z.enum(["UPCOMING", "COMPLETED"]).default("UPCOMING"),
});

export type GroupCoachingSessionActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a group coaching session (admin or instructor)
 */
export async function createGroupCoachingSessionAction(
  data: z.infer<typeof groupCoachingSessionSchema>
): Promise<GroupCoachingSessionActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    const validatedData = groupCoachingSessionSchema.parse(data);

    // Check if cohort exists and instructor has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: validatedData.cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Instructors can only create sessions for their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to create a session for this cohort",
      };
    }

    const session = await prisma.groupCoachingSession.create({
      data: validatedData,
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: session };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create group coaching session: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating the session",
    };
  }
}

/**
 * Update a group coaching session (admin or instructor)
 */
export async function updateGroupCoachingSessionAction(
  sessionId: string,
  data: Partial<z.infer<typeof groupCoachingSessionSchema>>
): Promise<GroupCoachingSessionActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if session exists and instructor has permission
    const existingSession = await prisma.groupCoachingSession.findUnique({
      where: { id: sessionId },
      include: {
        cohort: true,
      },
    });

    if (!existingSession) {
      return {
        success: false,
        error: "Session introuvable",
      };
    }

    // Instructors can only update sessions for their own cohorts
    if (user.role === "INSTRUCTOR" && existingSession.cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to edit this session",
      };
    }

    const validatedData = groupCoachingSessionSchema.partial().parse(data);

    const session = await prisma.groupCoachingSession.update({
      where: { id: sessionId },
      data: validatedData,
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: session };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update group coaching session: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error updating the session",
    };
  }
}

/**
 * Delete a group coaching session (admin or instructor)
 */
export async function deleteGroupCoachingSessionAction(
  sessionId: string
): Promise<GroupCoachingSessionActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if session exists and instructor has permission
    const existingSession = await prisma.groupCoachingSession.findUnique({
      where: { id: sessionId },
      include: {
        cohort: true,
      },
    });

    if (!existingSession) {
      return {
        success: false,
        error: "Session introuvable",
      };
    }

    // Instructors can only delete sessions for their own cohorts
    if (user.role === "INSTRUCTOR" && existingSession.cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to delete this session",
      };
    }

    await prisma.groupCoachingSession.delete({
      where: { id: sessionId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete group coaching session: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the session",
    };
  }
}

/**
 * Get all group coaching sessions for a cohort
 */
export async function getGroupCoachingSessionsAction(
  cohortId: string
): Promise<{ success: boolean; error?: string; data?: any[] }> {
  try {
    await requireAuth();

    const sessions = await prisma.groupCoachingSession.findMany({
      where: { cohortId },
      orderBy: { scheduledAt: "asc" },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: sessions };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get group coaching sessions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving sessions",
    };
  }
}

/**
 * Get a single group coaching session
 */
export async function getGroupCoachingSessionAction(
  sessionId: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    await requireAuth();

    const session = await prisma.groupCoachingSession.findUnique({
      where: { id: sessionId },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!session) {
      return {
        success: false,
        error: "Session introuvable",
      };
    }

    return { success: true, data: session };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get group coaching session: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving the session",
    };
  }
}

