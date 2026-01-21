"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  getPhaseAllocation,
  getWeeksUntilExam,
  getBlocksPerWeek,
  getPhaseDistribution,
  checkFeasibility,
  generateStudyBlocks,
  type StudyPlanConfig,
} from "@/lib/utils/study-plan";
import {
  generateNewStudyPlan,
  type NewStudyPlanResult,
} from "@/lib/utils/new-study-plan";
import { checkPhase3Access } from "@/lib/utils/phase3-gate";
import { SelfRating, TaskType, PlanEntryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Initialize or update user course settings
 */
export async function initializeCourseSettingsAction(
  courseId: string,
  data: {
    examDate: Date;
    studyHoursPerWeek: number;
    preferredStudyDays?: number[];
    selfRating: SelfRating;
  }
) {
  try {
    const user = await requireAuth();

    // Check if course is in "Professionnels" category
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { category: true },
    });

    if (!course) {
      return { success: false, error: "Course not found" };
    }

    if (course.category.name !== "Professionnels") {
      return { success: false, error: "This system is only available for professional courses" };
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: courseId,
        expiresAt: { gte: new Date() },
      },
    });

    if (!enrollment) {
      return { success: false, error: "You are not enrolled in this course" };
    }

    // Check if settings already exist (to detect first creation vs update)
    const existingSettings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    const isFirstCreation = !existingSettings || !existingSettings.orientationCompleted;

    // Create or update settings
    const settings = await prisma.userCourseSettings.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
      create: {
        userId: user.id,
        courseId: courseId,
        examDate: data.examDate,
        studyHoursPerWeek: data.studyHoursPerWeek,
        preferredStudyDays: data.preferredStudyDays ? (data.preferredStudyDays as any) : null,
        selfRating: data.selfRating,
        planCreatedAt: new Date(),
        orientationCompleted: false,
      },
      update: {
        examDate: data.examDate,
        studyHoursPerWeek: data.studyHoursPerWeek,
        preferredStudyDays: data.preferredStudyDays ? (data.preferredStudyDays as any) : null,
        selfRating: data.selfRating,
        // Keep original planCreatedAt to preserve week numbers
        // Only update if this is first creation
        // Week numbers should persist even after plan regeneration
        planCreatedAt: isFirstCreation ? new Date() : existingSettings.planCreatedAt,
        // Don't reset orientationCompleted on update - only set to false on first creation
        orientationCompleted: isFirstCreation ? false : existingSettings.orientationCompleted,
      },
    });

    // Generate study plan and capture warnings
    const planResult = await generateStudyPlanAction(courseId);

    revalidatePath(`/learn/${courseId}`);
    return { 
      success: true, 
      data: settings,
      isFirstCreation, // Return flag to indicate if this is first creation
      warnings: planResult.warnings || [],
      minimumStudyTime: planResult.minimumStudyTime,
      blocksAvailable: planResult.blocksAvailable,
      meetsMinimum: planResult.meetsMinimum,
    };
  } catch (error) {
    console.error("Error initializing course settings:", error);
    return { success: false, error: "Error initializing settings" };
  }
}

/**
 * Mark orientation as completed
 */
export async function completeOrientationAction(courseId: string) {
  try {
    const user = await requireAuth();

    await prisma.userCourseSettings.updateMany({
      where: {
        userId: user.id,
        courseId: courseId,
      },
      data: {
        orientationCompleted: true,
      },
    });

    revalidatePath(`/learn/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Error completing orientation:", error);
    return { success: false, error: "Error updating" };
  }
}

/**
 * Generate or regenerate study plan
 */
export async function generateStudyPlanAction(courseId: string) {
  try {
    const user = await requireAuth();

    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    if (!settings || !settings.examDate) {
      return { success: false, error: "Study plan settings not configured" };
    }

    // Generate study blocks using enhanced algorithm
    const config: StudyPlanConfig = {
      examDate: settings.examDate,
      studyHoursPerWeek: settings.studyHoursPerWeek,
      selfRating: settings.selfRating,
      preferredStudyDays: settings.preferredStudyDays as number[] | undefined,
      planCreatedAt: settings.planCreatedAt,
    };

    const result: NewStudyPlanResult = await generateNewStudyPlan(
      courseId,
      user.id,
      config
    );

    // Check for errors (e.g., past exam date)
    if ((result as any).error) {
      return { success: false, error: (result as any).error };
    }

    console.log(`[generateStudyPlanAction] Generated ${result.blocks.length} total blocks`);
    console.log(`[generateStudyPlanAction] Block breakdown:`, {
      LEARN: result.blocks.filter(b => b.taskType === TaskType.LEARN).length,
      REVIEW: result.blocks.filter(b => b.taskType === TaskType.REVIEW).length,
      PRACTICE: result.blocks.filter(b => b.taskType === TaskType.PRACTICE).length,
    });
    const uniqueModules = new Set(result.blocks.filter(b => b.targetModuleId).map(b => b.targetModuleId));
    console.log(`[generateStudyPlanAction] Blocks for ${uniqueModules.size} unique modules`);
    console.log(`[generateStudyPlanAction] Phase 1 end week: ${result.phase1EndWeek}`);

    // Get existing entries with their statuses before deletion (to preserve completed statuses)
    const existingEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
      },
      select: {
        id: true,
        date: true,
        taskType: true,
        targetModuleId: true,
        targetContentItemId: true,
        targetQuizId: true,
        status: true,
        estimatedBlocks: true,
      },
    });

    // Create a map of existing entries by their identifying characteristics
    // Key: date-taskType-moduleId-contentItemId-quizId
    const existingEntriesMap = new Map<string, typeof existingEntries[0]>();
    existingEntries.forEach((entry) => {
      const key = `${entry.date.toISOString().split('T')[0]}-${entry.taskType}-${entry.targetModuleId || ''}-${entry.targetContentItemId || ''}-${entry.targetQuizId || ''}`;
      existingEntriesMap.set(key, entry);
    });

    // Delete ALL existing plan entries for this course (to ensure clean regeneration)
    // We delete all entries, not just future ones, to handle cases where exam date changed
    const deleteResult = await prisma.dailyPlanEntry.deleteMany({
      where: {
        userId: user.id,
        courseId: courseId,
      },
    });
    console.log(`[generateStudyPlanAction] Deleted ${deleteResult.count} existing plan entries`);

    // Create new plan entries (include off-platform items like lecture rapide/lente so they're checkable)
    // Track review blocks to split them 50/50
    const reviewBlocks = result.blocks.filter(
      (block) => block.taskType === TaskType.REVIEW
    );
    const totalReviewBlocks = reviewBlocks.length;
    const flashcardBlocks = Math.ceil(totalReviewBlocks / 2);
    
    let reviewBlockIndex = 0;
    
    const planEntries = result.blocks
      // Create entries for all blocks, including off-platform items (lecture rapide/lente)
      // so they can be checked off
      .map((block) => {
        // For Phase 2 review blocks, mark them as flashcard or activity sessions
        let targetFlashcardIds = null;
        if (block.taskType === TaskType.REVIEW) {
          // First half are flashcards, second half are activities
          const isFlashcard = reviewBlockIndex < flashcardBlocks;
          reviewBlockIndex++;
          
          // Store empty array with a marker - we'll use the presence of the array
          // to indicate it's a review session (even if empty)
          targetFlashcardIds = isFlashcard ? ([] as any) : ([] as any);
          // Note: We can't distinguish in the database, but aggregation will split 50/50
        } else if (block.targetFlashcardIds) {
          targetFlashcardIds = block.targetFlashcardIds as any;
        }

        // Check if this entry matches an existing completed entry
        const dateKey = block.date.toISOString().split('T')[0];
        const entryKey = `${dateKey}-${block.taskType}-${block.targetModuleId || ''}-${block.targetContentItemId || ''}-${block.targetQuizId || ''}`;
        const existingEntry = existingEntriesMap.get(entryKey);
        
        // Preserve status if entry was completed, otherwise set to PENDING
        const status = existingEntry && existingEntry.status === PlanEntryStatus.COMPLETED
          ? PlanEntryStatus.COMPLETED
          : PlanEntryStatus.PENDING;

        return {
          userId: user.id,
          courseId: courseId,
          date: block.date,
          taskType: block.taskType,
          targetModuleId: block.targetModuleId || null,
          targetContentItemId: block.targetContentItemId || null,
          targetQuizId: block.targetQuizId || null,
          targetFlashcardIds: block.taskType === TaskType.REVIEW ? ([] as any) : (block.targetFlashcardIds as any) || null,
          status: status,
          estimatedBlocks: block.estimatedBlocks,
          order: block.order,
          completedAt: existingEntry && existingEntry.status === PlanEntryStatus.COMPLETED ? new Date() : null,
        };
      });

    console.log(`[generateStudyPlanAction] Preparing to save ${planEntries.length} plan entries`);
    console.log(`[generateStudyPlanAction] Entry breakdown before save:`, {
      LEARN: planEntries.filter(e => e.taskType === TaskType.LEARN).length,
      REVIEW: planEntries.filter(e => e.taskType === TaskType.REVIEW).length,
      PRACTICE: planEntries.filter(e => e.taskType === TaskType.PRACTICE).length,
    });

    // Batch insert in chunks of 100
    let totalInserted = 0;
    try {
      for (let i = 0; i < planEntries.length; i += 100) {
        const chunk = planEntries.slice(i, i + 100);
        const insertResult = await prisma.dailyPlanEntry.createMany({
          data: chunk,
          skipDuplicates: true, // Skip duplicates if any
        });
        totalInserted += insertResult.count;
        console.log(`[generateStudyPlanAction] Inserted chunk ${Math.floor(i / 100) + 1}: ${insertResult.count} entries`);
      }
      console.log(`[generateStudyPlanAction] Created ${totalInserted} new plan entries (expected ${planEntries.length})`);
      if (totalInserted !== planEntries.length) {
        console.warn(`[generateStudyPlanAction] WARNING: Expected ${planEntries.length} entries but only inserted ${totalInserted}`);
      }
    } catch (insertError) {
      console.error(`[generateStudyPlanAction] Error inserting plan entries:`, insertError);
      // Continue anyway - some entries may have been saved
    }

    // Initialize module progress for all modules
    const modules = await prisma.module.findMany({
      where: { courseId: courseId },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    if (modules.length > 0) {
      await prisma.moduleProgress.createMany({
        data: modules.map((module) => ({
          userId: user.id,
          courseId: courseId,
          moduleId: module.id,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath(`/learn/${courseId}`);
    
    // Return warnings and additional info
    const response: any = {
      success: true,
      warnings: result.warnings,
      minimumStudyTime: result.minimumStudyTime,
      blocksAvailable: result.blocksAvailable,
      meetsMinimum: result.meetsMinimum,
    };

    if (result.omitPhase1) {
      response.omitPhase1 = true;
    }

    if (result.requiredHoursPerWeek) {
      response.requiredHoursPerWeek = result.requiredHoursPerWeek;
      response.suggestChangeExamDate = true;
    }

    if (result.phase1EndWeek) {
      response.phase1EndWeek = result.phase1EndWeek;
    }

    return response;
  } catch (error) {
    console.error("Error generating study plan:", error);
    return { success: false, error: "Error generating the study plan" };
  }
}

/**
 * Get user course settings
 */
// Cached function to get user course settings
const getCachedUserCourseSettings = unstable_cache(
  async (userId: string, courseId: string) => {
    return await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });
  },
  ["user-course-settings"],
  { revalidate: 300, tags: ["user-course-settings"] } // 5 minutes
);

const getCachedTodaysPlan = unstable_cache(
  async (userId: string, courseId: string, dayKey: string) => {
    const today = new Date(`${dayKey}T00:00:00`);
    today.setHours(0, 0, 0, 0);

    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!settings || !settings.planCreatedAt) {
      return { success: false, error: "Study plan not configured" };
    }

    const { calculateWeek1StartDate } = await import("@/lib/utils/study-plan");
    const week1StartDate = calculateWeek1StartDate(settings.planCreatedAt);

    const daysDiff = Math.floor(
      (today.getTime() - week1StartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentWeek = Math.floor(daysDiff / 7) + 1;

    const weekStart = new Date(week1StartDate);
    weekStart.setDate(week1StartDate.getDate() + (currentWeek - 1) * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        userId,
        courseId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
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
        order: "asc",
      },
    });

    const moduleProgress = await prisma.moduleProgress.findMany({
      where: {
        userId,
        courseId,
      },
      select: {
        moduleId: true,
        learnStatus: true,
      },
    });

    const doneModules = new Set(
      moduleProgress
        .filter((p) => p.learnStatus === "LEARNED")
        .map((p) => p.moduleId)
    );

    const phase1Entries = weekEntries.filter(
      (e) => e.taskType === TaskType.LEARN && e.targetModuleId && !doneModules.has(e.targetModuleId)
    );

    const firstPhase1ModuleId = phase1Entries[0]?.targetModuleId;
    const phase1Tasks = firstPhase1ModuleId
      ? phase1Entries.filter((e) => e.targetModuleId === firstPhase1ModuleId)
      : [];

    const phase2Tasks = weekEntries.filter((e) => e.taskType === TaskType.REVIEW);

    const allTasks = [...phase1Tasks, ...phase2Tasks];
    const selectedTasks = allTasks.slice(0, 6).map(task => ({
      ...task,
      status: task.status || PlanEntryStatus.PENDING,
    }));

    const sections = formatTodaysPlanSections(selectedTasks, phase2Tasks);

    return {
      success: true,
      data: {
        sections,
        totalBlocks: selectedTasks.reduce((sum, t) => sum + t.estimatedBlocks, 0),
        phase1Module: firstPhase1ModuleId
          ? phase1Tasks[0]?.module
          : null,
      },
    };
  },
  ["todays-plan"],
  { revalidate: 300, tags: ["todays-plan"] }
);

export async function getUserCourseSettingsAction(courseId: string) {
  try {
    const user = await requireAuth();

    // Get cached settings
    const settings = await getCachedUserCourseSettings(user.id, courseId);

    return { success: true, data: settings };
  } catch (error) {
    console.error("Error getting course settings:", error);
    return { success: false, error: "Error retrieving settings" };
  }
}

/**
 * Get today's plan
 * Based on current week's tasks:
 * - Show one Phase 1 module (first not done)
 * - Show all Phase 2 tasks
 * - Format into 4 sections: Session courte (1 block), Session longue (2 blocks), Session courte supplémentaire (1 block), Session longue supplémentaire (2 blocks)
 * - Total: 6 blocks = 3 hours
 */
export async function getTodaysPlanAction(courseId: string) {
  try {
    const user = await requireAuth();
    const dayKey = new Date().toISOString().split("T")[0];

    return await getCachedTodaysPlan(user.id, courseId, dayKey);
  } catch (error) {
    console.error("Error getting today's plan:", error);
    return { success: false, error: "Error retrieving today's plan" };
  }
}

/**
 * Format tasks into 4 sections for plan du jour
 * Distributes tasks to fill all 4 sections: 1 block, 2 blocks, 1 block, 2 blocks (total 6 blocks)
 * sessionCourteSupplementaire must always be a Phase 2 item
 */
function formatTodaysPlanSections(
  tasks: Array<{
    id: string;
    taskType: TaskType;
    targetModuleId: string | null;
    targetContentItemId: string | null;
    targetQuizId: string | null;
    estimatedBlocks: number;
    module: { id: string; title: string; order: number } | null;
    status: PlanEntryStatus;
  }>,
  phase2Tasks: Array<{
    id: string;
    taskType: TaskType;
    targetModuleId: string | null;
    targetContentItemId: string | null;
    targetQuizId: string | null;
    estimatedBlocks: number;
    module: { id: string; title: string; order: number } | null;
    status: PlanEntryStatus;
  }>
): {
  sessionCourte: any[];
  sessionLongue: any[];
  sessionCourteSupplementaire: any[];
  sessionLongueSupplementaire: any[];
} {
  const sections = {
    sessionCourte: [] as any[],
    sessionLongue: [] as any[],
    sessionCourteSupplementaire: [] as any[],
    sessionLongueSupplementaire: [] as any[],
  };

  // Separate Phase 1 and Phase 2 tasks from the selected tasks
  const phase1Tasks = tasks.filter(t => t.taskType === TaskType.LEARN);
  const phase2TasksInSelected = tasks.filter(t => t.taskType === TaskType.REVIEW);
  
  // Track which tasks have been used
  const usedTaskIds = new Set<string>();
  
  // Helper to mark task as used
  const useTask = (task: typeof tasks[0] | null) => {
    if (task) {
      usedTaskIds.add(task.id);
    }
  };
  
  // Helper to get available tasks (not yet used)
  const getAvailable = (taskList: typeof tasks) => taskList.filter(t => !usedTaskIds.has(t.id));

  // Target distribution: 1 block, 2 blocks, 1 block, 2 blocks (total 6 blocks)
  // sessionCourteSupplementaire (3rd section) must be Phase 2
  
  // IMPORTANT: Reserve a Phase 2 task for session courte supplémentaire FIRST
  // This ensures it always gets a Phase 2 task even if Phase 2 tasks are used in earlier sections
  let reservedPhase2Task: typeof tasks[0] | null = null;
  
  // Try to reserve from selected tasks first
  const availablePhase2 = getAvailable(phase2TasksInSelected);
  if (availablePhase2.length > 0) {
    reservedPhase2Task = availablePhase2.find(t => t.estimatedBlocks === 1) ||
                         availablePhase2.find(t => t.estimatedBlocks <= 1) ||
                         availablePhase2[0];
  } else if (phase2Tasks && phase2Tasks.length > 0) {
    // Fallback: use from the full phase2Tasks parameter (all Phase 2 tasks from the week)
    // Find one that's in our selected tasks or use any available one
    reservedPhase2Task = phase2Tasks.find(t => tasks.some(st => st.id === t.id) && !usedTaskIds.has(t.id) && t.estimatedBlocks === 1) ||
                         phase2Tasks.find(t => tasks.some(st => st.id === t.id) && !usedTaskIds.has(t.id) && t.estimatedBlocks <= 1) ||
                         phase2Tasks.find(t => tasks.some(st => st.id === t.id) && !usedTaskIds.has(t.id)) ||
                         phase2Tasks.find(t => !usedTaskIds.has(t.id) && t.estimatedBlocks === 1) ||
                         phase2Tasks.find(t => !usedTaskIds.has(t.id)) ||
                         phase2Tasks[0];
  }
  
  if (reservedPhase2Task) {
    useTask(reservedPhase2Task);
  }
  
  // Session courte (1 block) - prefer Phase 1, avoid using reserved Phase 2 task
  const availablePhase1 = getAvailable(phase1Tasks);
  const sessionCourteTask = availablePhase1.find(t => t.estimatedBlocks === 1) || 
                            availablePhase1.find(t => t.estimatedBlocks <= 1) ||
                            getAvailable(phase2TasksInSelected).find(t => t.id !== reservedPhase2Task?.id && t.estimatedBlocks === 1) ||
                            getAvailable(tasks).find(t => t.id !== reservedPhase2Task?.id && t.estimatedBlocks === 1);
  if (sessionCourteTask) {
    sections.sessionCourte.push(sessionCourteTask);
    useTask(sessionCourteTask);
  }

  // Session longue (2 blocks) - prefer Phase 1, avoid using reserved Phase 2 task
  const sessionLongueTask = availablePhase1.find(t => t.estimatedBlocks === 2) ||
                            availablePhase1.find(t => t.estimatedBlocks <= 2) ||
                            getAvailable(phase2TasksInSelected).find(t => t.id !== reservedPhase2Task?.id && t.estimatedBlocks === 2) ||
                            getAvailable(tasks).find(t => t.id !== reservedPhase2Task?.id && t.estimatedBlocks === 2);
  if (sessionLongueTask) {
    sections.sessionLongue.push(sessionLongueTask);
    useTask(sessionLongueTask);
  }

  // Session courte supplémentaire (1 block) - MUST be Phase 2 (use reserved task)
  if (reservedPhase2Task) {
    sections.sessionCourteSupplementaire.push(reservedPhase2Task);
  } else {
    // Fallback if no Phase 2 task was reserved (shouldn't happen, but handle gracefully)
    const fallbackPhase2 = getAvailable(phase2TasksInSelected)[0] || 
                           (phase2Tasks && phase2Tasks.length > 0 ? phase2Tasks.find(t => !usedTaskIds.has(t.id)) : null);
    if (fallbackPhase2) {
      sections.sessionCourteSupplementaire.push(fallbackPhase2);
      useTask(fallbackPhase2);
    }
  }

  // Session longue supplémentaire (2 blocks) - any remaining task
  const remainingTasks = getAvailable(tasks);
  if (remainingTasks.length > 0) {
    sections.sessionLongueSupplementaire.push(remainingTasks[0]);
    useTask(remainingTasks[0]);
  }

  console.log(`[formatTodaysPlanSections] Input: ${tasks.length} tasks (${phase1Tasks.length} Phase 1, ${phase2TasksInSelected.length} Phase 2 in selected)`);
  console.log(`[formatTodaysPlanSections] Phase 2 tasks available: ${phase2Tasks?.length || 0}`);
  console.log(`[formatTodaysPlanSections] Reserved Phase 2 task:`, reservedPhase2Task ? `${reservedPhase2Task.id} (${reservedPhase2Task.estimatedBlocks} blocks)` : 'NONE');
  console.log(`[formatTodaysPlanSections] Distributed tasks into sections:`, {
    sessionCourte: sections.sessionCourte.length,
    sessionLongue: sections.sessionLongue.length,
    sessionCourteSupplementaire: sections.sessionCourteSupplementaire.length,
    sessionLongueSupplementaire: sections.sessionLongueSupplementaire.length,
  });
  
  // Ensure session courte supplémentaire always has a task (even if it's not Phase 2 as fallback)
  if (sections.sessionCourteSupplementaire.length === 0 && phase2Tasks && phase2Tasks.length > 0) {
    console.warn(`[formatTodaysPlanSections] No Phase 2 task found for additional short session, using first available Phase 2 task`);
    const fallbackTask = phase2Tasks.find(t => !usedTaskIds.has(t.id)) || phase2Tasks[0];
    if (fallbackTask) {
      sections.sessionCourteSupplementaire.push(fallbackTask);
      useTask(fallbackTask);
    }
  }

  return sections;
}

/**
 * Get weekly study plan (organized by weeks from plan start to exam)
 */
export async function getWeeklyStudyPlanAction(courseId: string) {
  try {
    const user = await requireAuth();
    
    // Get user settings to find plan start date and exam date
    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    if (!settings || !settings.examDate || !settings.planCreatedAt) {
      return { success: false, error: "Study plan not configured" };
    }

    // Calculate Week 1 start date (Monday of week containing planCreatedAt)
    const { calculateWeek1StartDate } = await import("@/lib/utils/study-plan");
    const week1StartDate = calculateWeek1StartDate(settings.planCreatedAt);
    const examDate = new Date(settings.examDate);
    examDate.setHours(23, 59, 59, 999);

    // Get all plan entries from Week 1 start to exam date
    let planEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
        date: {
          gte: week1StartDate,
          lte: examDate,
        },
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
      orderBy: [
        { date: "asc" },
        { order: "asc" },
      ],
    });

    // If no review entries or no plan entries, regenerate once
    const hasReview = planEntries.some((e) => e.taskType === TaskType.REVIEW);
    if (planEntries.length === 0 || !hasReview) {
      console.log(
        `[getWeeklyStudyPlanAction] Plan incomplete (total=${planEntries.length}, hasReview=${hasReview}), regenerating...`
      );
      await generateStudyPlanAction(courseId);
      planEntries = await prisma.dailyPlanEntry.findMany({
        where: {
          userId: user.id,
          courseId: courseId,
          date: {
            gte: week1StartDate,
            lte: examDate,
          },
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
        orderBy: [
          { date: "asc" },
          { order: "asc" },
        ],
      });
      console.log(
        `[getWeeklyStudyPlanAction] After regen: total=${planEntries.length}, review=${planEntries.filter(
          (e) => e.taskType === TaskType.REVIEW
        ).length}`
      );
    }

    // Get all modules for the course
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        order: true,
      },
    });

    // Get Phase 1 end week from settings or calculate it
    const weeksUntilExam = Math.ceil(
      (examDate.getTime() - week1StartDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    const phase1EndWeek = Math.max(1, weeksUntilExam - 2); // 2 weeks before exam

    // Aggregate into weekly tasks
    const { aggregateWeeklyTasks } = await import("@/lib/utils/weekly-plan-aggregator");
    const weeks = await aggregateWeeklyTasks(planEntries, modules, week1StartDate, examDate, phase1EndWeek);

    return { 
      success: true, 
      data: weeks,
      week1StartDate,
      examDate,
    };
  } catch (error) {
    console.error("Error getting weekly study plan:", error);
    return { success: false, error: "Error retrieving the study plan" };
  }
}

/**
 * Get study plan entries for a date range
 */
export async function getStudyPlanAction(courseId: string, startDate?: Date, endDate?: Date) {
  try {
    const user = await requireAuth();
    
    // Default to current week if no dates provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!startDate) {
      startDate = new Date(today);
      // Start from Monday of current week
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      startDate.setDate(diff);
    } else {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);
    }
    
    if (!endDate) {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // 7 days (current week)
    } else {
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const planEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        module: {
          include: {
            course: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { order: "asc" },
      ],
    });

    return { success: true, data: planEntries };
  } catch (error) {
    console.error("Error getting study plan:", error);
    return { success: false, error: "Error retrieving the study plan" };
  }
}

/**
 * Update plan entry status
 */
export async function updatePlanEntryStatusAction(
  entryId: string,
  status: PlanEntryStatus,
  actualTimeSpentSeconds?: number
) {
  try {
    const user = await requireAuth();

    const entry = await prisma.dailyPlanEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.userId !== user.id) {
      return { success: false, error: "Plan entry not found" };
    }

    await prisma.dailyPlanEntry.update({
      where: { id: entryId },
      data: {
        status,
        actualTimeSpentSeconds: actualTimeSpentSeconds || null,
        completedAt: status === PlanEntryStatus.COMPLETED ? new Date() : null,
      },
    });

    revalidatePath(`/learn/${entry.courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating plan entry:", error);
    return { success: false, error: "Error updating" };
  }
}

/**
 * Mark module as learned
 */
export async function markModuleAsLearnedAction(courseId: string, moduleId: string) {
  try {
    const user = await requireAuth();

    await prisma.moduleProgress.update({
      where: {
        userId_moduleId: {
          userId: user.id,
          moduleId: moduleId,
        },
      },
      data: {
        learnStatus: "LEARNED",
        lastLearnedAt: new Date(),
      },
    });

    // Add module to review queue
    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    // Items from completed chapters are automatically available in Smart Review
    // No need to manually add to review queue

    revalidatePath(`/learn/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Error marking module as learned:", error);
    return { success: false, error: "Error updating" };
  }
}

/**
 * Check Phase 3 access (all modules must be learned)
 */
export async function checkPhase3AccessAction(courseId: string) {
  try {
    const user = await requireAuth();
    const result = await checkPhase3Access(user.id, courseId);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error checking Phase 3 access:", error);
    return { success: false, error: "Error checking access to Phase 3" };
  }
}

/**
 * Check if user is behind schedule
 */
export async function checkBehindScheduleAction(courseId: string) {
  try {
    const user = await requireAuth();
    
    const settings = await prisma.userCourseSettings.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    if (!settings || !settings.examDate || !settings.planCreatedAt) {
      return { success: true, isBehind: false };
    }

    // Get today's plan
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEntries = await prisma.dailyPlanEntry.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
        date: today,
      },
    });

    // Get module progress
    const moduleProgress = await prisma.moduleProgress.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
      },
    });

    // Get content inventory
    const { getCourseContentInventory } = await import("@/lib/utils/course-content-inventory");
    const inventory = await getCourseContentInventory(courseId);
    
    // Calculate blocks available vs required
    const { getWeeksUntilExam, getBlocksPerWeek } = await import("@/lib/utils/study-plan");
    const examDate = new Date(settings.examDate);
    const planCreatedAt = new Date(settings.planCreatedAt);
    const weeksUntilExam = getWeeksUntilExam(examDate, planCreatedAt);
    const blocksPerWeek = getBlocksPerWeek(settings.studyHoursPerWeek);
    const blocksAvailable = weeksUntilExam * blocksPerWeek;
    const minimumStudyTime = inventory.minimumStudyTime;

    // Check if behind minimum
    if (blocksAvailable < minimumStudyTime) {
      const deficit = minimumStudyTime - blocksAvailable;
      const additionalHours = Math.ceil(deficit / 2);
      return {
        success: true,
        isBehind: true,
        warning: `Temps d'étude insuffisant. Minimum requis: ${minimumStudyTime} blocs, disponible: ${blocksAvailable} blocs.`,
        suggestions: [
          `Augmentez vos heures d'étude de ${additionalHours} heures par semaine`,
          "Change the scheduled exam date to allow more time",
        ],
      };
    }

    // Check if behind on daily tasks
    const completedToday = todayEntries.filter((e) => e.status === "COMPLETED").length;
    const totalToday = todayEntries.length;
    const pendingToday = totalToday - completedToday;

    // Check module progress
    const learnedModules = moduleProgress.filter((p) => p.learnStatus === "LEARNED").length;
    const totalModules = inventory.modules.length;
    const unlearnedModules = totalModules - learnedModules;

    // Check if many pending tasks and exam is soon
    const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (pendingToday > 2 && daysUntilExam < weeksUntilExam * 7 * 0.5) {
      const suggestions: string[] = [];
      
      if (unlearnedModules > 0) {
        suggestions.push(
          `Marquez ${unlearnedModules} module(s) comme terminé(s) si vous les avez déjà complétés`
        );
      }
      
      suggestions.push("Increase your study hours per week");
      suggestions.push("Change the scheduled exam date if necessary");
      
      return {
        success: true,
        isBehind: true,
        warning: `Vous avez ${pendingToday} tâche(s) en attente aujourd'hui. Vous risquez de prendre du retard.`,
        suggestions,
        unlearnedModules,
      };
    }

    return { success: true, isBehind: false };
  } catch (error) {
    console.error("Error checking behind schedule:", error);
    return { success: false, error: "Error checking the plan" };
  }
}

/**
 * Get module progress
 */
export async function getModuleProgressAction(courseId: string) {
  try {
    const user = await requireAuth();

    const progress = await prisma.moduleProgress.findMany({
      where: {
        userId: user.id,
        courseId: courseId,
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

    return { success: true, data: progress };
  } catch (error) {
    console.error("Error getting module progress:", error);
    return { success: false, error: "Error retrieving progress" };
  }
}

