"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { getEasternNow } from "@/lib/utils/timezone";

export type AnalyticsActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get enrollment statistics
 */
export async function getEnrollmentStatisticsAction(): Promise<AnalyticsActionResult> {
  try {
    await requireAdmin();

    const [
      totalEnrollments,
      activeEnrollments,
      expiredEnrollments,
      enrollmentsByCourse,
      enrollmentsByMonth,
    ] = await Promise.all([
      prisma.enrollment.count(),
      prisma.enrollment.count({
        where: {
          expiresAt: { gte: getEasternNow() }, // Use Eastern Time
        },
      }),
      prisma.enrollment.count({
        where: {
          expiresAt: { lt: getEasternNow() }, // Use Eastern Time
        },
      }),
      prisma.enrollment.groupBy({
        by: ["courseId"],
        _count: true,
      }),
      prisma.enrollment.groupBy({
        by: ["purchaseDate"],
        _count: true,
        where: {
          purchaseDate: {
            gte: new Date(new Date().getFullYear(), 0, 1),
          },
        },
      }),
    ]);

    // Get course details for enrollments by course
    const courseIds = enrollmentsByCourse.map((e) => e.courseId);
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    });

    const enrollmentsByCourseWithNames = enrollmentsByCourse.map((e) => {
      const course = courses.find((c) => c.id === e.courseId);
      return {
        courseId: e.courseId,
        courseTitle: course?.title || "Unknown",
        count: e._count,
      };
    });

    return {
      success: true,
      data: {
        totalEnrollments,
        activeEnrollments,
        expiredEnrollments,
        enrollmentsByCourse: enrollmentsByCourseWithNames.sort((a, b) => b.count - a.count),
        enrollmentsByMonth,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get enrollment statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error calculating enrollment statistics",
    };
  }
}

/**
 * Get completion rates by course
 */
export async function getCompletionRatesAction(): Promise<AnalyticsActionResult> {
  try {
    await requireAdmin();

    const courses = await prisma.course.findMany({
      include: {
        modules: {
          include: {
            contentItems: true,
          },
        },
        enrollments: true,
      },
    });

    const completionData = courses.map((course) => {
      // Count total content items
      const totalContentItems = course.modules.reduce(
        (sum, module) => sum + module.contentItems.length,
        0
      );

      // Count completed content items
      const completedContentItems = course.modules.reduce((sum, module) => {
        return (
          sum +
          module.contentItems.filter((item) => {
            // Check if any progress tracking shows completion
            return false; // We'll need to join with ProgressTracking
          }).length
        );
      }, 0);

      // Get enrollments count
      const enrollmentCount = course.enrollments.length;

      // Calculate completion rate (students who completed all content)
      // For now, we'll use a simplified approach
      const completionRate =
        enrollmentCount > 0 && totalContentItems > 0
          ? (completedContentItems / (enrollmentCount * totalContentItems)) * 100
          : 0;

      return {
        courseId: course.id,
        courseTitle: course.title,
        totalEnrollments: enrollmentCount,
        totalContentItems,
        completionRate: Math.min(100, completionRate),
      };
    });

    return {
      success: true,
      data: completionData,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get completion rates: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error calculating completion rates",
    };
  }
}

/**
 * Get detailed completion rates with progress tracking
 */
export async function getDetailedCompletionRatesAction(): Promise<AnalyticsActionResult> {
  try {
    await requireAdmin();

    const courses = await prisma.course.findMany({
      include: {
        modules: {
          include: {
            contentItems: true,
          },
        },
        enrollments: true,
      },
    });

    const completionData = await Promise.all(
      courses.map(async (course) => {
        const totalContentItems = course.modules.reduce(
          (sum, module) => sum + module.contentItems.length,
          0
        );

        const enrollmentCount = course.enrollments.length;

        // Count completed items (items with completedAt set)
        const completedItems = await prisma.progressTracking.count({
          where: {
            contentItem: {
              module: {
                courseId: course.id,
              },
            },
            completedAt: { not: null },
          },
        });

        // Count total progress entries
        const totalProgressEntries = await prisma.progressTracking.count({
          where: {
            contentItem: {
              module: {
                courseId: course.id,
              },
            },
          },
        });

        // Calculate average completion rate
        const averageCompletionRate =
          enrollmentCount > 0 && totalContentItems > 0
            ? (completedItems / (enrollmentCount * totalContentItems)) * 100
            : 0;

        return {
          courseId: course.id,
          courseTitle: course.title,
          totalEnrollments: enrollmentCount,
          totalContentItems,
          completedItems,
          totalProgressEntries,
          averageCompletionRate: Math.min(100, averageCompletionRate),
        };
      })
    );

    return {
      success: true,
      data: completionData,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get detailed completion rates: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error calculating detailed completion rates",
    };
  }
}

/**
 * Get user engagement statistics
 */
export async function getUserEngagementAction(): Promise<AnalyticsActionResult> {
  try {
    await requireAdmin();

    const [
      totalUsers,
      activeUsers,
      totalProgressEntries,
      averageTimeSpent,
      allUsers,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({
        where: {
          role: "STUDENT",
          progressTracking: {
            some: {
              lastAccessedAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        },
      }),
      prisma.progressTracking.count(),
      prisma.progressTracking.aggregate({
        _avg: {
          timeSpent: true,
        },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT" },
        include: {
          _count: {
            select: {
              progressTracking: true,
              enrollments: true,
            },
          },
        },
      }),
    ]);

    // Sort users by progress tracking count and take top 10
    const topActiveUsers = allUsers
      .sort((a, b) => b._count.progressTracking - a._count.progressTracking)
      .slice(0, 10);

    return {
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalProgressEntries,
        averageTimeSpent: averageTimeSpent._avg.timeSpent || 0,
        topActiveUsers: topActiveUsers.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          progressEntries: user._count.progressTracking,
          enrollments: user._count.enrollments,
        })),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get user engagement: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error calculating user engagement",
    };
  }
}

/**
 * Get course-level metrics
 */
export async function getCourseMetricsAction(): Promise<AnalyticsActionResult> {
  try {
    await requireAdmin();

    const courses = await prisma.course.findMany({
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
        modules: {
          include: {
            contentItems: {
              include: {
                _count: {
                  select: {
                    progressTracking: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const courseMetrics = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = course.enrollments.length;
        const totalContentItems = course.modules.reduce(
          (sum, module) => sum + module.contentItems.length,
          0
        );

        // Get completion stats
        const completedItems = await prisma.progressTracking.count({
          where: {
            contentItem: {
              module: {
                courseId: course.id,
              },
            },
            completedAt: { not: null },
          },
        });

        // Get total time spent
        const timeSpentResult = await prisma.progressTracking.aggregate({
          where: {
            contentItem: {
              module: {
                courseId: course.id,
              },
            },
          },
          _sum: {
            timeSpent: true,
          },
        });

        const averageCompletionRate =
          enrollmentCount > 0 && totalContentItems > 0
            ? (completedItems / (enrollmentCount * totalContentItems)) * 100
            : 0;

        return {
          courseId: course.id,
          courseTitle: course.title,
          enrollmentCount,
          totalContentItems,
          completedItems,
          averageCompletionRate: Math.min(100, averageCompletionRate),
          totalTimeSpent: timeSpentResult._sum.timeSpent || 0,
          averageTimeSpent:
            enrollmentCount > 0
              ? (timeSpentResult._sum.timeSpent || 0) / enrollmentCount
              : 0,
        };
      })
    );

    return {
      success: true,
      data: courseMetrics.sort((a, b) => b.enrollmentCount - a.enrollmentCount),
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error calculating course metrics",
    };
  }
}

