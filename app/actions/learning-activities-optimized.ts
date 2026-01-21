"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

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

/**
 * Optimized: Get learning activities WITH attempts in a single call
 * This reduces round trips and improves performance
 */
export async function getStudentLearningActivitiesWithAttemptsAction(
  courseId: string,
  moduleId?: string | null
) {
  try {
    const user = await requireAuth();

    // Check enrollment (cached)
    const enrollment = await getCachedEnrollment(user.id, courseId);

    if (!enrollment) {
      return {
        success: false,
        error: "You are not enrolled in this course or your access has expired",
        data: [],
        attempts: {},
      };
    }

    // Use direct courseId field for efficient querying
    const where: any = {
      courseId,
    };

    if (moduleId) {
      where.moduleId = moduleId;
    }

    // Load activities first
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
        contentItem: {
          select: {
            moduleId: true,
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

    // Get activity IDs
    const activityIds = activities.map((a) => a.id);

    // Now fetch attempts for the activities we found (in parallel with attempt counts)
    const [attemptsResult, attemptCounts] = activityIds.length > 0 ? await Promise.all([
      prisma.learningActivityAttempt.findMany({
        where: {
          userId: user.id,
          learningActivityId: { in: activityIds },
        },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          learningActivityId: true,
          answers: true,
          score: true,
          completedAt: true,
          timeSpent: true,
        },
      }),
      prisma.learningActivityAttempt.groupBy({
        by: ["learningActivityId"],
        where: {
          userId: user.id,
          learningActivityId: { in: activityIds },
        },
        _count: {
          id: true,
        },
      }),
    ]) : [[], []];

    const countMap = new Map(attemptCounts.map((c) => [c.learningActivityId, c._count.id]));

    // Group attempts by activityId and get most recent
    const attemptsByActivity = new Map<string, typeof attemptsResult[0]>();
    for (const attempt of attemptsResult) {
      if (!attemptsByActivity.has(attempt.learningActivityId)) {
        attemptsByActivity.set(attempt.learningActivityId, attempt);
      }
    }

    // Build attempts data structure
    const attemptsData: Record<string, { mostRecentAttempt: any; attemptCount: number }> = {};
    for (const activityId of activityIds) {
      const attempt = attemptsByActivity.get(activityId);
      attemptsData[activityId] = {
        mostRecentAttempt: attempt
          ? {
              id: attempt.id,
              answers: attempt.answers,
              score: attempt.score,
              completedAt: attempt.completedAt,
              timeSpent: attempt.timeSpent,
            }
          : null,
        attemptCount: countMap.get(activityId) || 0,
      };
    }

    // Normalize activities - ensure module info is available from either direct moduleId or contentItem
    const normalizedActivities = activities.map((activity) => {
      // If activity has direct moduleId and module, use that
      if (activity.moduleId && activity.module) {
        return activity;
      }
      // Otherwise, use module from contentItem
      if (activity.contentItem?.module) {
        return {
          ...activity,
          moduleId: activity.contentItem.moduleId || activity.moduleId,
          module: activity.contentItem.module,
        };
      }
      // Fallback to activity as-is
      return activity;
    });

    return {
      success: true,
      data: normalizedActivities,
      attempts: attemptsData,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get learning activities with attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading activities",
      data: [],
      attempts: {},
    };
  }
}
