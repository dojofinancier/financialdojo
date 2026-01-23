"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

const learningActivitySchema = z.object({
  moduleId: z.string().optional().nullable(),
  courseId: z.string().optional(), // Direct courseId - preferred when available from caller
  activityType: z.enum([
    "SHORT_ANSWER",
    "FILL_IN_BLANK",
    "SORTING_RANKING",
    "CLASSIFICATION",
    "NUMERIC_ENTRY",
    "TABLE_COMPLETION",
    "ERROR_SPOTTING",
    "DEEP_DIVE",
  ]),
  title: z.string().optional(), // Optional - will use activity type label if not provided
  instructions: z.string().optional().nullable(),
  content: z.any(), // JSON structure varies by activity type
  correctAnswers: z.any().optional().nullable(),
  tolerance: z.number().optional().nullable(),
  contentItemId: z.string().min(1, "Content item ID is required"),
});

export type LearningActivityActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

// Cached function to get module IDs for a course
const getCachedCourseModuleIds = unstable_cache(
  async (courseId: string) => {
    const modules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true },
    });
    return modules.map((m) => m.id);
  },
  ["course-module-ids"],
  { revalidate: 600, tags: ["course-modules"] } // 10 minutes
);

// Cached function to check enrollment
const getCachedEnrollment = unstable_cache(
  async (userId: string, courseId: string) => {
    return await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
    });
  },
  ["enrollment-check"],
  { revalidate: 600, tags: ["enrollments"] } // 10 minutes
);

export async function getLearningActivitiesAction(
  courseId: string,
  moduleId?: string | null
): Promise<LearningActivityActionResult> {
  try {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    await requireAuth();

    // Use direct courseId field for efficient querying
    const where: any = {
      courseId,
    };

    if (moduleId) {
      where.moduleId = moduleId;
    }

    const activities = await prisma.learningActivity.findMany({
      where,
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
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
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: activities };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("getLearningActivitiesAction error:", errorMessage, errorStack);

    await logServerError({
      errorMessage: `Failed to get learning activities: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading activities: ${errorMessage}`,
      data: [],
    };
  }
}

/**
 * Get learning activities for a student (enrolled courses only)
 */
export async function getStudentLearningActivitiesAction(
  courseId: string,
  moduleId?: string | null
): Promise<LearningActivityActionResult> {
  try {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    const user = await requireAuth();

    // Verify enrollment (cached)
    const enrollment = await getCachedEnrollment(user.id, courseId);

    if (!enrollment) {
      return {
        success: false,
        error: "You are not enrolled in this course or your access has expired",
        data: [],
      };
    }

    // Get all modules for the course (cached)
    const moduleIds = await getCachedCourseModuleIds(courseId);

    const where: any = {
      moduleId: { in: moduleIds }, // Use direct moduleId field instead of contentItem join
    };

    if (moduleId) {
      where.moduleId = moduleId;
    }

    const activities = await prisma.learningActivity.findMany({
      where,
      select: {
        id: true,
        activityType: true,
        title: true,
        instructions: true,
        content: true,
        correctAnswers: true,
        tolerance: true,
        moduleId: true,
        module: {
          select: {
            id: true,
            title: true,
          },
        },
        // Removed contentItem include - not needed, moduleId is direct
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: activities };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("getStudentLearningActivitiesAction error:", errorMessage, errorStack);

    await logServerError({
      errorMessage: `Failed to get student learning activities: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading activities: ${errorMessage}`,
      data: [],
    };
  }
}

export async function createLearningActivityAction(
  data: z.infer<typeof learningActivitySchema>
): Promise<LearningActivityActionResult> {
  try {
    await requireAdmin();

    const validatedData = learningActivitySchema.parse(data);

    // Use title if provided, otherwise generate from activity type
    const activityTypeLabels: Record<string, string> = {
      SHORT_ANSWER: "Short answer",
      FILL_IN_BLANK: "Fill-in-the-blank",
      SORTING_RANKING: "Tri / Classement",
      CLASSIFICATION: "Classification",
      NUMERIC_ENTRY: "Numeric calculation",
      TABLE_COMPLETION: "Table to complete",
      ERROR_SPOTTING: "Error detection",
      DEEP_DIVE: "Approfondissement",
    };
    const finalTitle = validatedData.title || activityTypeLabels[validatedData.activityType] || "Activity";

    // Get courseId - prefer direct courseId if provided, otherwise derive from contentItem
    let finalCourseId = validatedData.courseId;
    
    if (!finalCourseId) {
      // Fall back to deriving courseId from contentItem -> module -> course
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: validatedData.contentItemId },
        select: {
          module: {
            select: {
              courseId: true,
            },
          },
        },
      });

      if (!contentItem?.module?.courseId) {
        console.error("createLearningActivityAction: Failed to find courseId for contentItem:", validatedData.contentItemId);
        return {
          success: false,
          error: "Content item must be associated with a module that belongs to a course",
        };
      }
      
      finalCourseId = contentItem.module.courseId;
    }

    const activity = await prisma.learningActivity.create({
      data: {
        contentItemId: validatedData.contentItemId,
        courseId: finalCourseId,
        moduleId: validatedData.moduleId || null,
        activityType: validatedData.activityType,
        title: finalTitle,
        instructions: validatedData.instructions || null,
        content: validatedData.content,
        correctAnswers: validatedData.correctAnswers || null,
        tolerance: validatedData.tolerance || null,
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
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
      },
    });

    return { success: true, data: activity };
  } catch (error) {
    console.error("createLearningActivityAction error:", error);
    
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      console.error("Validation errors:", errorDetails);
      return {
        success: false,
        error: `Invalid data: ${errorDetails}`,
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if it's a Prisma error (table doesn't exist, etc.)
    if (errorMessage.includes("Unknown arg") || errorMessage.includes("does not exist") || errorMessage.includes("model")) {
      return {
        success: false,
        error: "Database error. Make sure you have run the migration: npx prisma migrate dev",
      };
    }

    await logServerError({
      errorMessage: `Failed to create learning activity: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error creating the activity: ${errorMessage}`,
    };
  }
}

export async function updateLearningActivityAction(
  activityId: string,
  data: Partial<Omit<z.infer<typeof learningActivitySchema>, "contentItemId">>
): Promise<LearningActivityActionResult> {
  try {
    await requireAdmin();

    const updateSchema = z.object({
      moduleId: z.string().nullable().optional(),
      activityType: z
        .enum([
          "SHORT_ANSWER",
          "FILL_IN_BLANK",
          "SORTING_RANKING",
          "CLASSIFICATION",
          "NUMERIC_ENTRY",
          "TABLE_COMPLETION",
          "ERROR_SPOTTING",
          "DEEP_DIVE",
        ])
        .optional(),
      title: z.string().optional(),
      instructions: z.string().nullable().optional(),
      content: z.any().optional(),
      correctAnswers: z.any().nullable().optional(),
      tolerance: z.number().nullable().optional(),
    });

    const validatedData = updateSchema.parse(data);

    // Generate title from activity type if not provided
    const activityTypeLabels: Record<string, string> = {
      SHORT_ANSWER: "Short answer",
      FILL_IN_BLANK: "Fill-in-the-blank",
      SORTING_RANKING: "Tri / Classement",
      CLASSIFICATION: "Classification",
      NUMERIC_ENTRY: "Numeric calculation",
      TABLE_COMPLETION: "Table to complete",
      ERROR_SPOTTING: "Error detection",
      DEEP_DIVE: "Approfondissement",
    };

    // Get current activity to know the activity type if it's not being changed
    const currentActivity = await prisma.learningActivity.findUnique({
      where: { id: activityId },
      select: { activityType: true },
    });

    const updateData: any = {};
    if (validatedData.moduleId !== undefined) {
      updateData.moduleId = validatedData.moduleId === null || validatedData.moduleId === "" ? null : validatedData.moduleId;
    }
    if (validatedData.activityType !== undefined) {
      updateData.activityType = validatedData.activityType;
    }
    // Always auto-generate title from activity type
    const finalActivityType = validatedData.activityType || currentActivity?.activityType;
    if (finalActivityType) {
      updateData.title = activityTypeLabels[finalActivityType] || "Activity";
    }
    if (validatedData.instructions !== undefined) updateData.instructions = validatedData.instructions;
    if (validatedData.content !== undefined) updateData.content = validatedData.content;
    if (validatedData.correctAnswers !== undefined) updateData.correctAnswers = validatedData.correctAnswers;
    if (validatedData.tolerance !== undefined) updateData.tolerance = validatedData.tolerance;

    const activity = await prisma.learningActivity.update({
      where: { id: activityId },
      data: updateData,
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
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
      },
    });

    return { success: true, data: activity };
  } catch (error) {
    console.error("Update learning activity error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update learning activity: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error updating the activity: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function deleteLearningActivityAction(
  activityId: string
): Promise<LearningActivityActionResult> {
  try {
    await requireAdmin();

    await prisma.learningActivity.delete({
      where: { id: activityId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete learning activity: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting activity",
    };
  }
}

export async function bulkDeleteLearningActivitiesAction(
  activityIds: string[]
): Promise<LearningActivityActionResult & { deletedCount?: number }> {
  try {
    await requireAdmin();

    if (!activityIds || activityIds.length === 0) {
      return {
        success: false,
        error: "No activity selected",
      };
    }

    const result = await prisma.learningActivity.deleteMany({
      where: {
        id: {
          in: activityIds,
        },
      },
    });

    return {
      success: true,
      deletedCount: result.count,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to bulk delete learning activities: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting activities",
    };
  }
}
