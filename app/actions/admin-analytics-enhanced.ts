"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

export type AdminAnalyticsEnhancedActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get student usage patterns
 */
export async function getStudentUsagePatternsAction(
  studentId?: string,
  courseId?: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    const whereClause: any = {};
    if (studentId) whereClause.userId = studentId;
    if (courseId) whereClause.courseId = courseId;

    // Get activity timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      progressActivities,
      planActivities,
      quizActivities,
      reviewActivities,
    ] = await Promise.all([
      prisma.progressTracking.findMany({
        where: {
          ...whereClause,
          lastAccessedAt: { gte: thirtyDaysAgo },
          timeSpent: { gte: 300 }, // At least 5 minutes
        },
        select: {
          userId: true,
          lastAccessedAt: true,
          timeSpent: true,
        },
        orderBy: {
          lastAccessedAt: "desc",
        },
      }),
      prisma.dailyPlanEntry.findMany({
        where: {
          ...whereClause,
          date: { gte: thirtyDaysAgo },
          actualTimeSpentSeconds: { not: null },
        },
        select: {
          userId: true,
          date: true,
          actualTimeSpentSeconds: true,
        },
      }),
      prisma.quizAttempt.findMany({
        where: {
          ...whereClause,
          completedAt: { gte: thirtyDaysAgo },
          timeSpent: { not: null },
        },
        select: {
          userId: true,
          completedAt: true,
          timeSpent: true,
        },
      }),
      prisma.smartReviewItem.findMany({
        where: {
          ...whereClause,
          lastServedAt: { gte: thirtyDaysAgo },
        },
        select: {
          userId: true,
          lastServedAt: true,
          timesServed: true,
        },
      }),
    ]);

    // Calculate engagement scores per user
    const userActivity = new Map<string, {
      loginCount: number;
      studyTime: number;
      activities: number;
    }>();

    [...progressActivities, ...planActivities, ...quizActivities, ...reviewActivities].forEach((activity) => {
      const userId = activity.userId;
      if (!userActivity.has(userId)) {
        userActivity.set(userId, { loginCount: 0, studyTime: 0, activities: 0 });
      }
      const user = userActivity.get(userId)!;
      user.loginCount += 1;
      user.studyTime += (activity as any).timeSpent || (activity as any).actualTimeSpentSeconds || 0;
      user.activities += 1;
    });

    // Get unique study days per user
    const studyDays = new Map<string, Set<string>>();
    [...progressActivities, ...planActivities, ...quizActivities].forEach((activity) => {
      const userId = activity.userId;
      const date = (activity as any).lastAccessedAt || (activity as any).date || (activity as any).completedAt;
      if (date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        if (!studyDays.has(userId)) {
          studyDays.set(userId, new Set());
        }
        studyDays.get(userId)!.add(dateStr);
      }
    });

    // Calculate engagement scores
    const engagementScores = Array.from(userActivity.entries()).map(([userId, stats]) => {
      const uniqueDays = studyDays.get(userId)?.size || 0;
      const engagementScore = (stats.loginCount * 0.3) + (stats.studyTime / 3600 * 0.4) + (uniqueDays * 0.3);
      
      return {
        userId,
        loginCount: uniqueDays,
        studyTime: stats.studyTime,
        activities: stats.activities,
        engagementScore,
      };
    });

    // Get user emails
    const userIds = Array.from(userActivity.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const engagementScoresWithUsers = engagementScores
      .map(score => {
        const user = userMap.get(score.userId);
        const userName = user 
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
          : "Unknown";
        return {
          ...score,
          userEmail: user?.email || "Unknown",
          userName,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);

    return {
      success: true,
      data: {
        engagementScores: engagementScoresWithUsers,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get student usage patterns: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading usage patterns: ${errorMessage}`,
    };
  }
}

/**
 * Get content engagement analytics
 */
export async function getContentEngagementAction(
  courseId: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    // Get modules for the course
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      include: {
        contentItems: {
          include: {
            video: true,
            quiz: true,
          },
        },
      },
    });

    // Get progress tracking for all content items
    const contentItemIds = modules.flatMap(m => m.contentItems.map(ci => ci.id));
    const progressTracking = await prisma.progressTracking.findMany({
      where: {
        contentItemId: { in: contentItemIds },
      },
      select: {
        contentItemId: true,
        timeSpent: true,
        completedAt: true,
      },
    });

    // Get quiz attempts
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        quiz: {
          contentItem: {
            module: { courseId },
          },
        },
      },
      select: {
        quizId: true,
        completedAt: true,
      },
    });

    // Calculate module engagement
    const moduleEngagement = modules.map((module) => {
      const moduleContentItems = module.contentItems;
      const moduleProgress = progressTracking.filter(pt => 
        moduleContentItems.some(ci => ci.id === pt.contentItemId)
      );
      
      const totalViews = moduleProgress.length;
      const completedItems = moduleProgress.filter(pt => pt.completedAt !== null).length;
      const completionRate = moduleContentItems.length > 0 
        ? (completedItems / moduleContentItems.length) * 100 
        : 0;

      return {
        moduleId: module.id,
        moduleTitle: module.title,
        moduleOrder: module.order,
        totalViews,
        completionRate,
      };
    });

    // Get most viewed videos
    const videoProgress = progressTracking.filter(pt => {
      const contentItem = modules.flatMap(m => m.contentItems).find(ci => ci.id === pt.contentItemId);
      return contentItem?.video !== null;
    });

    const videoViews = new Map<string, { count: number; timeSpent: number; moduleTitle: string }>();
    videoProgress.forEach(pt => {
      const contentItem = modules.flatMap(m => m.contentItems).find(ci => ci.id === pt.contentItemId);
      if (contentItem?.video) {
        const moduleRecord = modules.find(m => m.contentItems.some(ci => ci.id === pt.contentItemId));
        if (!videoViews.has(pt.contentItemId)) {
          videoViews.set(pt.contentItemId, { count: 0, timeSpent: 0, moduleTitle: moduleRecord?.title || "" });
        }
        const stats = videoViews.get(pt.contentItemId)!;
        stats.count += 1;
        stats.timeSpent += pt.timeSpent || 0;
      }
    });

    const mostViewedVideos = Array.from(videoViews.entries())
      .map(([contentItemId, stats]) => ({
        contentItemId,
        viewCount: stats.count,
        totalTimeSpent: stats.timeSpent,
        moduleTitle: stats.moduleTitle,
      }))
      .sort((a, b) => b.viewCount - a.viewCount);

    // Get most attempted quizzes
    const quizAttemptCounts = new Map<string, number>();
    quizAttempts.forEach(attempt => {
      quizAttemptCounts.set(attempt.quizId, (quizAttemptCounts.get(attempt.quizId) || 0) + 1);
    });

    const mostAttemptedQuizzes = Array.from(quizAttemptCounts.entries())
      .map(([quizId, attemptCount]) => ({
        quizId,
        attemptCount,
      }))
      .sort((a, b) => b.attemptCount - a.attemptCount);

    return {
      success: true,
      data: {
        moduleEngagement,
        mostViewedVideos,
        mostAttemptedQuizzes,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get content engagement: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading content engagement: ${errorMessage}`,
    };
  }
}

/**
 * Get study plan analytics
 */
export async function getStudyPlanAnalyticsAction(
  courseId: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    // Get all enrollments for the course
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get study plan entries for all enrolled users
    const userIds = enrollments.map(e => e.userId);
    const planEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        courseId,
        userId: { in: userIds },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Get module progress
    const moduleProgress = await prisma.moduleProgress.findMany({
      where: {
        userId: { in: userIds },
        module: { courseId },
      },
    });

    // Get total modules count once
    const totalModules = await prisma.module.count({ where: { courseId } });

    // Calculate individual student analytics
    const individualAnalytics = enrollments.map(enrollment => {
      const userId = enrollment.userId;
      const userPlanEntries = planEntries.filter(pe => pe.userId === userId);
      const userModuleProgress = moduleProgress.filter(mp => mp.userId === userId);

      // Calculate adherence
      const totalTasks = userPlanEntries.length;
      const completedOnTime = userPlanEntries.filter(pe => 
        pe.status === "COMPLETED" && pe.completedAt && pe.date && 
        new Date(pe.completedAt) <= new Date(pe.date)
      ).length;
      const completedLate = userPlanEntries.filter(pe => 
        pe.status === "COMPLETED" && pe.completedAt && pe.date && 
        new Date(pe.completedAt) > new Date(pe.date)
      ).length;
      const skipped = userPlanEntries.filter(pe => pe.status !== "COMPLETED").length;

      const adherenceRate = totalTasks > 0 
        ? ((completedOnTime + completedLate) / totalTasks) * 100 
        : 0;

      // Phase 1 completion (modules learned)
      const learnedModules = userModuleProgress.filter(mp => mp.learnStatus === "LEARNED").length;
      const phase1Complete = totalModules > 0 ? (learnedModules / totalModules) * 100 : 0;

      // Review sessions
      const reviewSessions = userPlanEntries.filter(pe => pe.taskType === "REVIEW").length;

      // Phase 3 completion (mock exams - simplified)
      const phase3Complete = 0; // Would need to check assessment results

      const userName = enrollment.user.firstName || enrollment.user.lastName
        ? `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim()
        : enrollment.user.email;

      return {
        userId,
        userName,
        adherenceRate,
        tasksCompletedOnTime: completedOnTime,
        tasksCompletedLate: completedLate,
        tasksSkipped: skipped,
        phase1Complete,
        reviewSessions,
        phase3Complete,
      };
    });

    // Calculate aggregate statistics
    const totalStudents = individualAnalytics.length;
    const averageAdherence = totalStudents > 0
      ? individualAnalytics.reduce((sum, a) => sum + a.adherenceRate, 0) / totalStudents
      : 0;
    const averagePhase1Complete = totalStudents > 0
      ? individualAnalytics.reduce((sum, a) => sum + a.phase1Complete, 0) / totalStudents
      : 0;
    const averagePhase3Complete = totalStudents > 0
      ? individualAnalytics.reduce((sum, a) => sum + a.phase3Complete, 0) / totalStudents
      : 0;

    return {
      success: true,
      data: {
        aggregate: {
          totalStudents,
          averageAdherence,
          averagePhase1Complete,
          averagePhase3Complete,
        },
        individual: individualAnalytics,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get study plan analytics: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading study plan analytics: ${errorMessage}`,
    };
  }
}

/**
 * Get feature usage analytics
 */
export async function getFeatureUsageAction(
  courseId?: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    // Get enrollments
    const enrollments = courseId
      ? await prisma.enrollment.findMany({ where: { courseId } })
      : await prisma.enrollment.findMany();

    const userIds = enrollments.map(e => e.userId);
    const totalEnrolled = userIds.length;

    // Check feature usage
    const [
      smartReviewUsers,
      studyPlanUsers,
      flashcardUsers,
      activityUsers,
      questionBankUsers,
    ] = await Promise.all([
      // Smart Review users (have smart review progress)
      prisma.smartReviewProgress.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Study Plan users (have daily plan entries)
      prisma.dailyPlanEntry.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Flashcard users (have flashcard study sessions)
      prisma.flashcardStudySession.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Learning Activity users
      prisma.learningActivityAttempt.findMany({
        where: {
          learningActivity: courseId
            ? {
                contentItem: {
                  module: { courseId },
                },
              }
            : undefined,
          userId: { in: userIds },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Question Bank users
      prisma.questionBankAttempt.findMany({
        where: {
          questionBank: courseId ? { courseId } : undefined,
          userId: { in: userIds },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const featureUsage = {
      smartReview: {
        users: smartReviewUsers.length,
        percentage: totalEnrolled > 0 ? (smartReviewUsers.length / totalEnrolled) * 100 : 0,
      },
      studyPlan: {
        users: studyPlanUsers.length,
        percentage: totalEnrolled > 0 ? (studyPlanUsers.length / totalEnrolled) * 100 : 0,
      },
      flashcards: {
        users: flashcardUsers.length,
        percentage: totalEnrolled > 0 ? (flashcardUsers.length / totalEnrolled) * 100 : 0,
      },
      learningActivities: {
        users: activityUsers.length,
        percentage: totalEnrolled > 0 ? (activityUsers.length / totalEnrolled) * 100 : 0,
      },
      questionBanks: {
        users: questionBankUsers.length,
        percentage: totalEnrolled > 0 ? (questionBankUsers.length / totalEnrolled) * 100 : 0,
      },
    };

    return {
      success: true,
      data: {
        totalEnrolled,
        featureUsage,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get feature usage: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading feature usage: ${errorMessage}`,
    };
  }
}

/**
 * Get drop-off analysis
 */
export async function getDropOffAnalysisAction(
  courseId: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    // Get enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    const dropOffAnalysis = await Promise.all(
      enrollments.map(async (enrollment) => {
        const userId = enrollment.userId;

        // Get last activity
        const lastActivity = await prisma.progressTracking.findFirst({
          where: {
            userId,
            contentItem: {
              module: { courseId },
            },
          },
          orderBy: {
            lastAccessedAt: "desc",
          },
          include: {
            contentItem: {
              include: {
                module: {
                  select: {
                    id: true,
                    title: true,
                    order: true,
                  },
                },
              },
            },
          },
        });

        const daysSinceLastActivity = lastActivity?.lastAccessedAt
          ? Math.floor((Date.now() - new Date(lastActivity.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Get module progress
        const modulesLearned = await prisma.moduleProgress.count({
          where: {
            userId,
            module: { courseId },
            learnStatus: "LEARNED",
          },
        });

        const totalModules = await prisma.module.count({ where: { courseId } });
        const completionRate = totalModules > 0 ? (modulesLearned / totalModules) * 100 : 0;

        return {
          userId,
          userEmail: enrollment.user.email,
          lastActivity: lastActivity?.lastAccessedAt || null,
          daysSinceLastActivity: daysSinceLastActivity || 999,
          lastModule: lastActivity?.contentItem?.module || null,
          modulesLearned,
          totalModules,
          completionRate,
          isAtRisk: daysSinceLastActivity !== null && daysSinceLastActivity > 14,
        };
      })
    );

    const atRiskStudents = dropOffAnalysis.filter(a => a.isAtRisk).length;
    const averageTimeToDropOff = dropOffAnalysis.length > 0
      ? dropOffAnalysis.reduce((sum, a) => sum + (a.daysSinceLastActivity || 0), 0) / dropOffAnalysis.length
      : 0;

    // Find common drop-off points
    const dropOffModules = dropOffAnalysis
      .filter(a => a.lastModule)
      .map(a => a.lastModule!);
    
    const moduleDropOffCounts = new Map<string, number>();
    dropOffModules.forEach(moduleItem => {
      const key = `${moduleItem.id}`;
      moduleDropOffCounts.set(key, (moduleDropOffCounts.get(key) || 0) + 1);
    });

    const commonDropOffPoints = Array.from(moduleDropOffCounts.entries())
      .map(([moduleId, count]) => {
        const moduleMatch = dropOffModules.find(m => m.id === moduleId);
        return {
          module: moduleMatch ? `Module ${moduleMatch.order}: ${moduleMatch.title}` : "Unknown",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      success: true,
      data: {
        totalStudents: enrollments.length,
        atRiskStudents,
        averageTimeToDropOff,
        individual: dropOffAnalysis,
        commonDropOffPoints,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get drop-off analysis: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Error loading drop-off analysis: ${errorMessage}`,
    };
  }
}

/**
 * Get performance insights (score distributions, improvement trends, struggling students)
 */
export async function getPerformanceInsightsAction(
  courseId?: string
): Promise<AdminAnalyticsEnhancedActionResult> {
  try {
    await requireAdmin();

    const whereClause: any = {};
    if (courseId) {
      whereClause.quiz = {
        contentItem: {
          module: {
            courseId,
          },
        },
      };
    }

    // Get all quiz attempts
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: whereClause,
      include: {
        quiz: {
          include: {
            contentItem: {
              include: {
                module: {
                  select: {
                    id: true,
                    title: true,
                    order: true,
                    courseId: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    // Get mock exam attempts
    const mockExamAttempts = await prisma.quizAttempt.findMany({
      where: {
        ...whereClause,
        quiz: {
          ...whereClause.quiz,
          isMockExam: true,
        },
      },
      include: {
        quiz: {
          include: {
            contentItem: {
              include: {
                module: {
                  select: {
                    courseId: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    // Score distributions by course
    const scoreDistributionByCourse = new Map<string, number[]>();
    const mockExamScoresByCourse = new Map<string, number[]>();

    quizAttempts.forEach((attempt) => {
      const courseId = attempt.quiz.contentItem?.module?.courseId;
      if (courseId && attempt.score !== null) {
        if (!scoreDistributionByCourse.has(courseId)) {
          scoreDistributionByCourse.set(courseId, []);
        }
        scoreDistributionByCourse.get(courseId)!.push(attempt.score);
      }
    });

    mockExamAttempts.forEach((attempt) => {
      const courseId = attempt.quiz.contentItem?.module?.courseId;
      if (courseId && attempt.score !== null) {
        if (!mockExamScoresByCourse.has(courseId)) {
          mockExamScoresByCourse.set(courseId, []);
        }
        mockExamScoresByCourse.get(courseId)!.push(attempt.score);
      }
    });

    // Score distributions by module (for selected course)
    const scoreDistributionByModule = new Map<string, number[]>();
    if (courseId) {
      quizAttempts
        .filter((attempt) => attempt.quiz.contentItem?.module?.courseId === courseId)
        .forEach((attempt) => {
          const moduleId = attempt.quiz.contentItem?.module?.id;
          if (moduleId && attempt.score !== null) {
            if (!scoreDistributionByModule.has(moduleId)) {
              scoreDistributionByModule.set(moduleId, []);
            }
            scoreDistributionByModule.get(moduleId)!.push(attempt.score);
          }
        });
    }

    // Improvement trends (score improvement over time per student)
    const studentImprovementTrends = new Map<
      string,
      Array<{ date: Date; score: number; moduleOrder: number }>
    >();

    quizAttempts.forEach((attempt) => {
      if (attempt.score !== null && attempt.completedAt) {
        const userId = attempt.userId;
        const moduleOrder = attempt.quiz.contentItem?.module?.order || 0;

        if (!studentImprovementTrends.has(userId)) {
          studentImprovementTrends.set(userId, []);
        }
        studentImprovementTrends.get(userId)!.push({
          date: attempt.completedAt,
          score: attempt.score,
          moduleOrder,
        });
      }
    });

    // Calculate improvement trends
    const improvementData = Array.from(studentImprovementTrends.entries()).map(
      ([userId, attempts]) => {
        const sorted = attempts.sort((a, b) => a.date.getTime() - b.date.getTime());
        const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
        const secondHalf = sorted.slice(Math.ceil(sorted.length / 2));

        const avgFirst = firstHalf.reduce((sum, a) => sum + a.score, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, a) => sum + a.score, 0) / secondHalf.length;

        return {
          userId,
          improvement: avgSecond - avgFirst,
          totalAttempts: sorted.length,
          averageScore: sorted.reduce((sum, a) => sum + a.score, 0) / sorted.length,
        };
      }
    );

    // Identify struggling students
    const studentScores = new Map<string, number[]>();

    quizAttempts.forEach((attempt) => {
      if (attempt.score !== null) {
        const userId = attempt.userId;
        if (!studentScores.has(userId)) {
          studentScores.set(userId, []);
        }
        studentScores.get(userId)!.push(attempt.score);
      }
    });

    const strugglingStudents = Array.from(studentScores.entries())
      .map(([userId, scores]) => {
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const lowScores = scores.filter((s) => s < 70).length;
        const lowScoreRate = lowScores / scores.length;

        // Check for declining performance
        const userAttempts = quizAttempts
          .filter((a) => a.userId === userId && a.score !== null)
          .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());

        let declining = false;
        if (userAttempts.length >= 3) {
          const firstThird = userAttempts.slice(0, Math.ceil(userAttempts.length / 3));
          const lastThird = userAttempts.slice(-Math.ceil(userAttempts.length / 3));

          const avgFirst = firstThird.reduce((sum, a) => sum + a.score!, 0) / firstThird.length;
          const avgLast = lastThird.reduce((sum, a) => sum + a.score!, 0) / lastThird.length;

          declining = avgLast < avgFirst - 5; // 5% decline threshold
        }

        const user = quizAttempts.find((a) => a.userId === userId)?.user;
        const userName = user?.firstName || user?.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user?.email || "Unknown";

        return {
          userId,
          userEmail: user?.email || "Unknown",
          userName,
          averageScore: avgScore,
          totalAttempts: scores.length,
          lowScoreRate,
          isConsistentlyLow: avgScore < 60,
          isDeclining: declining,
          isAtRisk: avgScore < 60 || declining || lowScoreRate > 0.5,
        };
      })
      .filter((s) => s.isAtRisk)
      .sort((a, b) => a.averageScore - b.averageScore);

    // Format score distributions
    const formatDistribution = (scores: number[]) => {
      if (scores.length === 0) return null;
      return {
        min: Math.min(...scores),
        max: Math.max(...scores),
        average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        median: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)],
        distribution: {
          "0-50": scores.filter((s) => s < 50).length,
          "50-60": scores.filter((s) => s >= 50 && s < 60).length,
          "60-70": scores.filter((s) => s >= 60 && s < 70).length,
          "70-80": scores.filter((s) => s >= 70 && s < 80).length,
          "80-90": scores.filter((s) => s >= 80 && s < 90).length,
          "90-100": scores.filter((s) => s >= 90).length,
        },
      };
    };

    return {
      success: true,
      data: {
        scoreDistributions: {
          byCourse: Array.from(scoreDistributionByCourse.entries()).map(([courseId, scores]) => ({
            courseId,
            ...formatDistribution(scores),
          })),
          byModule: courseId
            ? Array.from(scoreDistributionByModule.entries()).map(([moduleId, scores]) => ({
                moduleId,
                ...formatDistribution(scores),
              }))
            : [],
        },
        mockExamScores: Array.from(mockExamScoresByCourse.entries()).map(([courseId, scores]) => ({
          courseId,
          ...formatDistribution(scores),
        })),
        improvementTrends: improvementData.sort((a, b) => b.improvement - a.improvement),
        strugglingStudents: strugglingStudents.slice(0, 50), // Top 50 struggling students
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to get performance insights: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    console.error("Performance insights error:", errorMessage, stackTrace);

    return {
      success: false,
      error: `Error loading performance insights: ${errorMessage}`,
    };
  }
}
