"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateContentAccess } from "@/lib/utils/access-validation";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";

export type ProgressActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Track content item completion
 * Called when user completes a content item (video watched, quiz passed, flashcard studied, etc.)
 */
export async function trackContentCompletionAction(
  contentItemId: string
): Promise<ProgressActionResult> {
  try {
    const user = await requireAuth();

    // Validate access
    const access = await validateContentAccess(user.id, contentItemId);
    if (!access.hasAccess) {
      return {
        success: false,
        error: access.reason || "Unauthorized access",
      };
    }

    // Update or create progress tracking
    const progress = await prisma.progressTracking.upsert({
      where: {
        userId_contentItemId: {
          userId: user.id,
          contentItemId,
        },
      },
      update: {
        completedAt: new Date(),
        lastAccessedAt: new Date(),
      },
      create: {
        userId: user.id,
        contentItemId,
        completedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    });

    return { success: true, data: progress };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to track content completion: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error tracking progress",
    };
  }
}

/**
 * Update time spent on content item
 */
export async function updateTimeSpentAction(
  contentItemId: string,
  timeSpentSeconds: number
): Promise<ProgressActionResult> {
  try {
    const user = await requireAuth();

    // Validate access
    const access = await validateContentAccess(user.id, contentItemId);
    if (!access.hasAccess) {
      return {
        success: false,
        error: access.reason || "Unauthorized access",
      };
    }

    const progress = await prisma.progressTracking.upsert({
      where: {
        userId_contentItemId: {
          userId: user.id,
          contentItemId,
        },
      },
      update: {
        timeSpent: {
          increment: timeSpentSeconds,
        },
        lastAccessedAt: new Date(),
      },
      create: {
        userId: user.id,
        contentItemId,
        timeSpent: timeSpentSeconds,
        lastAccessedAt: new Date(),
      },
    });

    return { success: true, data: progress };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update time spent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating time spent",
    };
  }
}

/**
 * Get user's progress for a course
 */
export async function getCourseProgressAction(courseId: string) {
  try {
    const user = await requireAuth();

    // Get all content items in the course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            contentItems: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    // Get all content item IDs
    const contentItemIds = course.modules.flatMap((module) =>
      module.contentItems.map((item) => item.id)
    );

    // Get progress for all content items
    const progress = await prisma.progressTracking.findMany({
      where: {
        userId: user.id,
        contentItemId: {
          in: contentItemIds,
        },
      },
    });

    // Calculate completion stats
    const totalItems = contentItemIds.length;
    const completedItems = progress.filter((p) => p.completedAt !== null).length;
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);

    return {
      courseId,
      totalItems,
      completedItems,
      completionPercentage: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
      totalTimeSpent,
      progress,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course progress: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Get user's overall progress
 */
export async function getUserProgressAction(params: {
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<any>> {
  try {
    const user = await requireAuth();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const progress = await prisma.progressTracking.findMany({
      where: { userId: user.id },
      take: limit + 1,
      cursor,
      orderBy: { lastAccessedAt: "desc" },
      include: {
        contentItem: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = progress.length > limit;
    const items = hasMore ? progress.slice(0, limit) : progress;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get user progress: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

