"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

export type StudentAnalyticsActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get student overview statistics
 */
export async function getStudentOverviewAction(
  courseId: string
): Promise<StudentAnalyticsActionResult> {
  try {
    const user = await requireAuth();

    // Get total study time from all sources
    const [
      progressTime,
      planTime,
      quizTime,
      activityTime,
      questionBankTime,
      reviewTime,
    ] = await Promise.all([
      // ProgressTracking time
      prisma.progressTracking.aggregate({
        where: {
          userId: user.id,
          contentItem: {
            module: { courseId },
          },
        },
        _sum: { timeSpent: true },
      }),
      // DailyPlanEntry time
      prisma.dailyPlanEntry.aggregate({
        where: {
          userId: user.id,
          courseId,
          actualTimeSpentSeconds: { not: null },
        },
        _sum: { actualTimeSpentSeconds: true },
      }),
      // QuizAttempt time
      prisma.quizAttempt.aggregate({
        where: {
          userId: user.id,
          quiz: {
            contentItem: {
              module: {
                courseId,
              },
            },
          },
          timeSpent: { not: null },
        },
        _sum: { timeSpent: true },
      }),
      // LearningActivityAttempt time
      prisma.learningActivityAttempt.aggregate({
        where: {
          userId: user.id,
          learningActivity: {
            contentItem: {
              module: {
                courseId,
              },
            },
          },
          timeSpent: { not: null },
        },
        _sum: { timeSpent: true },
      }),
      // QuestionBankAttempt time
      prisma.questionBankAttempt.aggregate({
        where: {
          userId: user.id,
          questionBank: {
            courseId,
          },
          timeSpent: { not: null },
        },
        _sum: { timeSpent: true },
      }),
      // SmartReview time (estimate: items reviewed * 30 seconds average)
      prisma.smartReviewProgress.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId,
          },
        },
        select: {
          totalItemsReviewed: true,
        },
      }),
    ]);

    const totalStudyTime =
      (progressTime._sum.timeSpent || 0) +
      (planTime._sum.actualTimeSpentSeconds || 0) +
      (quizTime._sum.timeSpent || 0) +
      (activityTime._sum.timeSpent || 0) +
      (questionBankTime._sum.timeSpent || 0) +
      ((reviewTime?.totalItemsReviewed || 0) * 30);

    // Get completion rate (modules learned / total modules)
    const [modulesLearned, totalModules] = await Promise.all([
      prisma.moduleProgress.count({
        where: {
          userId: user.id,
          courseId,
          learnStatus: "LEARNED",
        },
      }),
      prisma.module.count({
        where: { courseId },
      }),
    ]);

    const completionRate = totalModules > 0 ? (modulesLearned / totalModules) * 100 : 0;

    // Get study streak
    const streak = await calculateStudyStreak(user.id, courseId);

    // Get blocks completed
    const blocksCompleted = await prisma.dailyPlanEntry.count({
      where: {
        userId: user.id,
        courseId,
        status: "COMPLETED",
      },
    });

    // Get study days this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const studyDaysThisWeek = await getStudyDaysCount(user.id, courseId, weekStart, new Date());

    return {
      success: true,
      data: {
        totalStudyTime, // in seconds
        completionRate,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        blocksCompleted,
        studyDaysThisWeek,
        modulesLearned,
        totalModules,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    await logServerError({
      errorMessage: `Failed to get student overview: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    console.error("Student overview error:", errorMessage, stackTrace);

    return {
      success: false,
      error: `Error loading statistics: ${errorMessage}`,
    };
  }
}

/**
 * Get course progress details
 */
export async function getStudentProgressAction(
  courseId: string
): Promise<StudentAnalyticsActionResult> {
  try {
    const user = await requireAuth();

    // Get module progress
    const moduleProgress = await prisma.moduleProgress.findMany({
      where: {
        userId: user.id,
        courseId,
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
      },
      orderBy: {
        module: {
          order: "asc",
        },
      },
    });

    // Get phase completion
    const totalModules = await prisma.module.count({ where: { courseId } });
    const phase1Complete = moduleProgress.filter((p) => p.learnStatus === "LEARNED").length;

    // Phase 2: Smart Review items reviewed
    const smartReviewProgress = await prisma.smartReviewProgress.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });
    const totalItemsReviewed = smartReviewProgress?.totalItemsReviewed || 0;

    // Phase 3: Mock exams
    const mockExamsCompleted = await prisma.assessmentResult.count({
      where: {
        userId: user.id,
        courseId,
        assessmentType: "MOCK_EXAM",
      },
    });

    const totalMockExams = await prisma.quiz.count({
      where: {
        contentItem: {
          module: {
            courseId,
          },
        },
        isMockExam: true,
      },
    });

    // Get last activity date
    const lastActivity = await prisma.progressTracking.findFirst({
      where: {
        userId: user.id,
        contentItem: {
          module: { courseId },
        },
      },
      orderBy: {
        lastAccessedAt: "desc",
      },
      select: {
        lastAccessedAt: true,
      },
    });

    // Get upcoming tasks (from study plan)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingTasks = await prisma.dailyPlanEntry.findMany({
      where: {
        userId: user.id,
        courseId,
        date: { gte: today },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      orderBy: {
        date: "asc",
      },
      take: 5,
      include: {
        module: {
          select: {
            title: true,
          },
        },
      },
    });

    // Calculate total time spent in course
    const timeSpentResult = await prisma.progressTracking.aggregate({
      where: {
        userId: user.id,
        contentItem: {
          module: { courseId },
        },
      },
      _sum: { timeSpent: true },
    });

    return {
      success: true,
      data: {
        moduleProgress: moduleProgress.map((p) => ({
          moduleId: p.module.id,
          moduleTitle: p.module.title,
          moduleOrder: p.module.order,
          learnStatus: p.learnStatus,
          lastLearnedAt: p.lastLearnedAt,
          lastReviewedAt: p.lastReviewedAt,
          memoryStrength: p.memoryStrength,
          errorRate: p.errorRate,
        })),
        phase1: {
          completed: phase1Complete,
          total: totalModules,
          percentage: totalModules > 0 ? (phase1Complete / totalModules) * 100 : 0,
        },
        phase2: {
          totalItemsReviewed,
        },
        phase3: {
          completed: mockExamsCompleted,
          total: totalMockExams,
          percentage: totalMockExams > 0 ? (mockExamsCompleted / totalMockExams) * 100 : 0,
        },
        lastActivity: lastActivity?.lastAccessedAt || null,
        timeSpent: timeSpentResult._sum.timeSpent || 0, // in seconds
        upcomingTasks: upcomingTasks.map((task) => ({
          id: task.id,
          date: task.date,
          taskType: task.taskType,
          status: task.status,
          moduleTitle: task.module?.title || null,
        })),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    await logServerError({
      errorMessage: `Failed to get student progress: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    console.error("Student progress error:", errorMessage, stackTrace);

    return {
      success: false,
      error: `Error loading progress: ${errorMessage}`,
    };
  }
}

/**
 * Get student performance analytics
 */
export async function getStudentPerformanceAction(
  courseId: string
): Promise<StudentAnalyticsActionResult> {
  try {
    const user = await requireAuth();

    // Get quiz attempts with scores (optimized - only select what we need)
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId: user.id,
        quiz: {
          contentItem: {
            module: {
              courseId,
            },
          },
          isMockExam: false, // Phase 1 mini-quizzes only
        },
      },
      select: {
        completedAt: true,
        score: true,
        quiz: {
          select: {
            contentItem: {
              select: {
                module: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    // Get module performance
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      include: {
        moduleProgress: {
          where: { userId: user.id },
          take: 1,
        },
        contentItems: {
          where: {
            contentType: "QUIZ",
          },
          include: {
            quiz: {
              where: { isMockExam: false },
              include: {
                attempts: {
                  where: { userId: user.id },
                  orderBy: { completedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Get total content items count per module for completion rate
    const moduleContentCounts = await prisma.module.findMany({
      where: { courseId },
      select: {
        id: true,
        _count: {
          select: {
            contentItems: true,
          },
        },
      },
    });

    const contentCountMap = new Map(
      moduleContentCounts.map((m) => [m.id, m._count.contentItems])
    );

    const modulePerformance = modules.map((module) => {
      const progress = module.moduleProgress[0];
      
      // Get quiz scores from contentItems that have quizzes
      const quizScores = module.contentItems
        .filter((item) => item.quiz !== null && item.quiz.attempts.length > 0)
        .map((item) => item.quiz!.attempts[0]?.score)
        .filter((s): s is number => s !== undefined);

      const averageScore = quizScores.length > 0
        ? quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length
        : null;

      // Get completion rate for module content
      const totalContentItems = contentCountMap.get(module.id) || 0;
      const completedItems = progress?.learnStatus === "LEARNED" ? totalContentItems : 0;

      return {
        moduleId: module.id,
        moduleTitle: module.title,
        moduleOrder: module.order,
        averageScore,
        completionRate: totalContentItems > 0 ? (completedItems / totalContentItems) * 100 : 0,
        errorRate: progress?.errorRate || 0,
        memoryStrength: progress?.memoryStrength || 0,
      };
    });

    // Identify weak areas (modules with low scores or high error rates)
    const weakAreas = modulePerformance.filter(
      (m) => (m.averageScore !== null && m.averageScore < 70) || m.errorRate > 0.3
    );

    // Review sessions were planned but the model doesn't exist in Prisma schema.
    // Keep analytics functional with a safe fallback.
    const reviewSessions: Array<{ itemsReviewed: number }> = [];

    // Get flashcard difficulty distribution
    const flashcardSessions = await prisma.flashcardStudySession.findMany({
      where: {
        userId: user.id,
        flashcard: {
          courseId,
        },
      },
      select: {
        difficulty: true,
      },
    });

    const difficultyDistribution = {
      easy: flashcardSessions.filter((s) => s.difficulty === "EASY").length,
      difficult: flashcardSessions.filter((s) => s.difficulty === "DIFFICULT").length,
    };

    const masteryRate =
      flashcardSessions.length > 0
        ? (difficultyDistribution.easy / flashcardSessions.length) * 100
        : 0;

    return {
      success: true,
      data: {
        quizScoreTrends: quizAttempts.map((attempt) => ({
          date: attempt.completedAt,
          score: attempt.score,
          quizTitle: attempt.quiz.contentItem.module?.title || "Quiz",
        })),
        modulePerformance,
        weakAreas: weakAreas.map((m) => ({
          moduleId: m.moduleId,
          moduleTitle: m.moduleTitle,
          issues: [
            m.averageScore !== null && m.averageScore < 70 ? "Low quiz scores" : null,
            m.errorRate > 0.3 ? "High error rate" : null,
            m.completionRate < 50 ? "Low completion" : null,
          ].filter((i): i is string => i !== null),
        })),
        reviewEffectiveness: {
          sessionsCompleted: reviewSessions.length,
          averageItemsPerSession:
            reviewSessions.length > 0
              ? reviewSessions.reduce((sum, s) => sum + s.itemsReviewed, 0) / reviewSessions.length
              : 0,
          masteryRate,
          difficultyDistribution,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    await logServerError({
      errorMessage: `Failed to get student performance: ${errorMessage}`,
      stackTrace,
      severity: "MEDIUM",
    });

    console.error("Student performance error:", errorMessage, stackTrace);

    return {
      success: false,
      error: `Error loading performance: ${errorMessage}`,
    };
  }
}

/**
 * Get study habits analytics
 */
export async function getStudentStudyHabitsAction(
  courseId: string
): Promise<StudentAnalyticsActionResult> {
  try {
    const user = await requireAuth();

    // Get all study activities in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Get activities from various sources
    const [progressActivities, planActivities, quizActivities] = await Promise.all([
      prisma.progressTracking.findMany({
        where: {
          userId: user.id,
          contentItem: {
            module: { courseId },
          },
          lastAccessedAt: { gte: thirtyDaysAgo },
        },
        select: {
          lastAccessedAt: true,
          timeSpent: true,
        },
      }),
      prisma.dailyPlanEntry.findMany({
        where: {
          userId: user.id,
          courseId,
          date: { gte: thirtyDaysAgo },
          actualTimeSpentSeconds: { not: null },
        },
        select: {
          date: true,
          actualTimeSpentSeconds: true,
        },
      }),
      prisma.quizAttempt.findMany({
        where: {
          userId: user.id,
          quiz: {
            contentItem: {
              module: {
                courseId,
              },
            },
          },
          completedAt: { gte: thirtyDaysAgo },
          timeSpent: { not: null },
        },
        select: {
          completedAt: true,
          timeSpent: true,
        },
      }),
    ]);

    // Combine and process activities
    const activities: Array<{ date: Date; timeSpent: number; hour: number; dayOfWeek: number }> =
      [];

    // Process progress tracking
    for (const activity of progressActivities) {
      if (activity.timeSpent >= 300) {
        // At least 5 minutes
        const date = new Date(activity.lastAccessedAt);
        activities.push({
          date,
          timeSpent: activity.timeSpent,
          hour: date.getHours(),
          dayOfWeek: date.getDay(),
        });
      }
    }

    // Process plan activities
    for (const activity of planActivities) {
      if (activity.actualTimeSpentSeconds && activity.actualTimeSpentSeconds >= 300) {
        const date = new Date(activity.date);
        activities.push({
          date,
          timeSpent: activity.actualTimeSpentSeconds,
          hour: date.getHours(),
          dayOfWeek: date.getDay(),
        });
      }
    }

    // Process quiz activities
    for (const activity of quizActivities) {
      if (activity.timeSpent && activity.timeSpent >= 300) {
        const date = new Date(activity.completedAt);
        activities.push({
          date,
          timeSpent: activity.timeSpent,
          hour: date.getHours(),
          dayOfWeek: date.getDay(),
        });
      }
    }

    // Calculate study time by day of week
    const studyTimeByDay = [0, 0, 0, 0, 0, 0, 0]; // Sunday to Saturday
    for (const activity of activities) {
      studyTimeByDay[activity.dayOfWeek] += activity.timeSpent;
    }

    // Calculate study time by hour (0-23)
    const studyTimeByHour = new Array(24).fill(0);
    for (const activity of activities) {
      studyTimeByHour[activity.hour] += activity.timeSpent;
    }

    // Calculate daily study time (last 30 days)
    const dailyStudyTime = new Map<string, number>();
    for (const activity of activities) {
      const dateKey = activity.date.toISOString().split("T")[0];
      dailyStudyTime.set(dateKey, (dailyStudyTime.get(dateKey) || 0) + activity.timeSpent);
    }

    const dailyStudyTimeArray = Array.from(dailyStudyTime.entries())
      .map(([date, time]) => ({ date, time }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate weekly study time
    const weeklyStudyTime = calculateWeeklyStudyTime(activities);

    // Get study plan adherence
    const studyPlanAdherence = await calculateStudyPlanAdherence(user.id, courseId);

    // Get recommended study hours
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        recommendedStudyHoursMin: true,
        recommendedStudyHoursMax: true,
      },
    });

    return {
      success: true,
      data: {
        studyTimeByDay: studyTimeByDay.map((time, day) => ({
          day,
          dayName: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][day],
          timeSpent: time, // in seconds
        })),
        studyTimeByHour: studyTimeByHour.map((time, hour) => ({
          hour,
          timeSpent: time, // in seconds
        })),
        dailyStudyTime: dailyStudyTimeArray,
        weeklyStudyTime,
        studyPlanAdherence,
        recommendedHours: {
          min: course?.recommendedStudyHoursMin || 6,
          max: course?.recommendedStudyHoursMax || 10,
        },
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get study habits: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading study habits",
    };
  }
}

/**
 * Get student goals and achievements
 */
export async function getStudentGoalsAction(
  courseId: string
): Promise<StudentAnalyticsActionResult> {
  try {
    const user = await requireAuth();

    // Get study plan settings
    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (!settings || !settings.examDate) {
      return {
        success: true,
        data: {
          hasStudyPlan: false,
          goals: null,
          milestones: [],
          achievements: [],
        },
      };
    }

    // Get study plan progress
    const totalBlocks = await prisma.dailyPlanEntry.count({
      where: {
        userId: user.id,
        courseId,
      },
    });

    const completedBlocks = await prisma.dailyPlanEntry.count({
      where: {
        userId: user.id,
        courseId,
        status: "COMPLETED",
      },
    });

    const daysUntilExam = Math.ceil(
      (settings.examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get milestones
    const milestones = await getMilestones(user.id, courseId);

    // Get achievements
    const achievements = await getAchievements(user.id, courseId);

    return {
      success: true,
      data: {
        hasStudyPlan: true,
        goals: {
          totalBlocks,
          completedBlocks,
          percentage: totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0,
          daysUntilExam,
          examDate: settings.examDate,
          onTrack: daysUntilExam > 0 && (completedBlocks / totalBlocks) * 100 >=
            ((totalBlocks - daysUntilExam * 2) / totalBlocks) * 100, // Rough estimate
        },
        milestones,
        achievements,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get student goals: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading goals",
    };
  }
}

// Helper functions

/**
 * Calculate study streak (consecutive days with at least 5 minutes of activity)
 */
async function calculateStudyStreak(
  userId: string,
  courseId: string
): Promise<{ currentStreak: number; longestStreak: number }> {
  // Get all activities with at least 5 minutes (300 seconds)
  const activities = await getStudyActivities(userId, courseId);

  if (activities.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Group by date
  const dates = new Set<string>();
  for (const activity of activities) {
    const dateKey = activity.date.toISOString().split("T")[0];
    dates.add(dateKey);
  }

  const sortedDates = Array.from(dates)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime()); // Most recent first

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let checkDate = new Date(today);
  for (const date of sortedDates) {
    const dateStr = date.toISOString().split("T")[0];
    const checkStr = checkDate.toISOString().split("T")[0];

    if (dateStr === checkStr) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dateStr < checkStr) {
      // Gap found
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const daysDiff = Math.floor(
      (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
}

/**
 * Get study activities (at least 5 minutes)
 */
async function getStudyActivities(
  userId: string,
  courseId: string
): Promise<Array<{ date: Date; timeSpent: number }>> {
  const activities: Array<{ date: Date; timeSpent: number }> = [];

  // Progress tracking
  const progress = await prisma.progressTracking.findMany({
    where: {
      userId,
      contentItem: {
        module: { courseId },
      },
      timeSpent: { gte: 300 }, // At least 5 minutes
    },
    select: {
      lastAccessedAt: true,
      timeSpent: true,
    },
  });

  for (const p of progress) {
    activities.push({
      date: p.lastAccessedAt,
      timeSpent: p.timeSpent,
    });
  }

  // Daily plan entries
  const planEntries = await prisma.dailyPlanEntry.findMany({
    where: {
      userId,
      courseId,
      actualTimeSpentSeconds: { gte: 300 },
    },
    select: {
      date: true,
      actualTimeSpentSeconds: true,
    },
  });

  for (const entry of planEntries) {
    if (entry.actualTimeSpentSeconds) {
      activities.push({
        date: new Date(entry.date),
        timeSpent: entry.actualTimeSpentSeconds,
      });
    }
  }

  // Quiz attempts
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: {
        contentItem: {
          module: {
            courseId,
          },
        },
      },
      timeSpent: { gte: 300 },
    },
    select: {
      completedAt: true,
      timeSpent: true,
    },
  });

  for (const attempt of quizAttempts) {
    if (attempt.timeSpent) {
      activities.push({
        date: attempt.completedAt,
        timeSpent: attempt.timeSpent,
      });
    }
  }

  return activities;
}

/**
 * Get study days count in date range
 */
async function getStudyDaysCount(
  userId: string,
  courseId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const activities = await getStudyActivities(userId, courseId);

  const studyDays = new Set<string>();
  for (const activity of activities) {
    const activityDate = new Date(activity.date);
    if (activityDate >= startDate && activityDate <= endDate) {
      const dateKey = activityDate.toISOString().split("T")[0];
      studyDays.add(dateKey);
    }
  }

  return studyDays.size;
}

/**
 * Calculate weekly study time
 */
function calculateWeeklyStudyTime(
  activities: Array<{ date: Date; timeSpent: number }>
): Array<{ week: string; timeSpent: number }> {
  const weeklyTime = new Map<string, number>();

  for (const activity of activities) {
    const date = new Date(activity.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split("T")[0];

    weeklyTime.set(weekKey, (weeklyTime.get(weekKey) || 0) + activity.timeSpent);
  }

  return Array.from(weeklyTime.entries())
    .map(([week, time]) => ({ week, timeSpent: time }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Calculate study plan adherence
 */
async function calculateStudyPlanAdherence(
  userId: string,
  courseId: string
): Promise<{
  tasksCompletedOnTime: number;
  tasksCompletedLate: number;
  tasksSkipped: number;
  adherenceRate: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastTasks = await prisma.dailyPlanEntry.findMany({
    where: {
      userId,
      courseId,
      date: { lt: today },
    },
  });

  let tasksCompletedOnTime = 0;
  let tasksCompletedLate = 0;
  let tasksSkipped = 0;

  for (const task of pastTasks) {
    if (task.status === "COMPLETED") {
      if (task.completedAt && task.completedAt <= new Date(task.date.getTime() + 24 * 60 * 60 * 1000)) {
        // Completed on or before the day after scheduled date
        tasksCompletedOnTime++;
      } else {
        tasksCompletedLate++;
      }
    } else {
      tasksSkipped++;
    }
  }

  const totalTasks = pastTasks.length;
  const adherenceRate = totalTasks > 0
    ? ((tasksCompletedOnTime + tasksCompletedLate) / totalTasks) * 100
    : 0;

  return {
    tasksCompletedOnTime,
    tasksCompletedLate,
    tasksSkipped,
    adherenceRate,
  };
}

/**
 * Get milestones
 */
async function getMilestones(
  userId: string,
  courseId: string
): Promise<Array<{ id: string; title: string; description: string; achievedAt: Date | null }>> {
  const milestones: Array<{
    id: string;
    title: string;
    description: string;
    achievedAt: Date | null;
  }> = [];

  // First module completed
  const firstModule = await prisma.moduleProgress.findFirst({
    where: {
      userId,
      courseId,
      learnStatus: "LEARNED",
    },
    orderBy: {
      lastLearnedAt: "asc",
    },
  });

  milestones.push({
    id: "first-module",
    title: "First module completed",
    description: "You have completed your first module",
    achievedAt: firstModule?.lastLearnedAt || null,
  });

  // First quiz passed
  const firstQuiz = await prisma.quizAttempt.findFirst({
    where: {
      userId,
      quiz: {
        contentItem: {
          module: {
            courseId,
          },
        },
        isMockExam: false,
      },
      score: { gte: 70 },
    },
    orderBy: {
      completedAt: "asc",
    },
  });

  milestones.push({
    id: "first-quiz",
    title: "First quiz passed",
    description: "You passed your first quiz with 70% or more",
    achievedAt: firstQuiz?.completedAt || null,
  });

  milestones.push({
    id: "first-review",
    title: "First review session",
    description: "You have completed your first review session",
    achievedAt: null,
  });

  // Course completion
  const totalModules = await prisma.module.count({ where: { courseId } });
  const learnedModules = await prisma.moduleProgress.count({
    where: {
      userId,
      courseId,
      learnStatus: "LEARNED",
    },
  });

  if (learnedModules === totalModules && totalModules > 0) {
    const lastModule = await prisma.moduleProgress.findFirst({
      where: {
        userId,
        courseId,
        learnStatus: "LEARNED",
      },
      orderBy: {
        lastLearnedAt: "desc",
      },
    });

    milestones.push({
      id: "course-complete",
      title: "Course completed",
      description: "You have completed all modules in the course",
      achievedAt: lastModule?.lastLearnedAt || null,
    });
  } else {
    milestones.push({
      id: "course-complete",
      title: "Course completed",
      description: "You have completed all modules in the course",
      achievedAt: null,
    });
  }

  return milestones;
}

/**
 * Get achievements
 */
async function getAchievements(
  userId: string,
  courseId: string
): Promise<Array<{ id: string; title: string; description: string; achieved: boolean }>> {
  const achievements: Array<{
    id: string;
    title: string;
    description: string;
    achieved: boolean;
  }> = [];

  // 7-day streak
  const streak = await calculateStudyStreak(userId, courseId);
  achievements.push({
    id: "streak-7",
    title: "Apprenant constant",
    description: "7 consecutive days of study",
    achieved: streak.currentStreak >= 7,
  });

  // 30-day streak
  achievements.push({
    id: "streak-30",
    title: "Dedicated student",
    description: "30 consecutive days of study",
    achieved: streak.longestStreak >= 30,
  });

  // Quiz master (all quizzes > 80%)
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: {
        contentItem: {
          module: {
            courseId,
          },
        },
        isMockExam: false,
      },
    },
    select: {
      score: true,
    },
  });

  const allQuizzesAbove80 =
    quizAttempts.length > 0 && quizAttempts.every((attempt) => attempt.score >= 80);

  achievements.push({
    id: "quiz-master",
    title: "Quiz master",
    description: "Tous vos quiz ont un score de 80% ou plus",
    achieved: allQuizzesAbove80,
  });

  // Review champion (100 review sessions)
  // Review sessions were planned but the model doesn't exist in Prisma schema.
  const reviewSessions = 0;

  achievements.push({
    id: "review-champion",
    title: "Review champion",
    description: "100 review sessions completed",
    achieved: reviewSessions >= 100,
  });

  return achievements;
}

