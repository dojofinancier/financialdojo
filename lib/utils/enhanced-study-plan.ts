/**
 * Enhanced Study Plan Algorithm
 * Content-aware, adaptive study plan generation with Phase 1, 2, and 3 scheduling
 */

import { PrismaClient, TaskType, PlanEntryStatus } from "@prisma/client";
import {
  getWeeksUntilExam,
  getBlocksPerWeek,
  getSpacingIntervals,
  calculatePhase1Pace,
  calculateWeek1StartDate,
  type StudyPlanConfig,
} from "./study-plan";
import {
  getCourseContentInventory,
  type CourseContentInventory,
  type ModuleInventory,
} from "./course-content-inventory";
import {
  prioritizeFlashcards,
  prioritizeActivities,
} from "./enhanced-study-plan-prioritization";

const prisma = new PrismaClient();

export interface EnhancedStudyBlock {
  date: Date;
  taskType: TaskType;
  targetModuleId?: string;
  targetContentItemId?: string;
  targetQuizId?: string;
  targetFlashcardIds?: string[]; // JSON array in database
  estimatedBlocks: number;
  order: number;
  // Note: targetActivityIds and targetQuestionBankId can be stored in targetFlashcardIds JSON
  // or we can extend the schema later. For now, we'll use targetFlashcardIds for flashcards
  // and store activity/question bank info in a different way if needed.
}

export interface StudyPlanGenerationResult {
  blocks: EnhancedStudyBlock[];
  warnings: string[];
  minimumStudyTime: number;
  blocksAvailable: number;
  meetsMinimum: boolean;
}

/**
 * Generate enhanced content-aware study plan
 */
export async function generateEnhancedStudyPlan(
  courseId: string,
  userId: string,
  config: StudyPlanConfig
): Promise<StudyPlanGenerationResult> {
  const warnings: string[] = [];

  // Calculate time available (needed even for early returns)
  const weeksUntilExam = getWeeksUntilExam(config.examDate, config.planCreatedAt);
  const blocksPerWeek = getBlocksPerWeek(config.studyHoursPerWeek);
  const blocksAvailable = weeksUntilExam * blocksPerWeek;

  // Get content inventory
  const inventory = await getCourseContentInventory(courseId);
  
  // Debug: Verify we have all modules
  console.log(`[EnhancedStudyPlan] Course ${courseId}: Found ${inventory.modules.length} modules`);
  if (inventory.modules.length === 0) {
    return {
      blocks: [],
      warnings: ["No module found in this course"],
      minimumStudyTime: 0,
      blocksAvailable,
      meetsMinimum: false,
    };
  }

  // Check minimum study time
  const minimumStudyTime = inventory.minimumStudyTime;
  const meetsMinimum = blocksAvailable >= minimumStudyTime;
  if (!meetsMinimum) {
    const deficit = minimumStudyTime - blocksAvailable;
    const additionalHours = Math.ceil(deficit / 2);
    warnings.push(
      `Insufficient study time. Minimum required: ${minimumStudyTime} blocks, available: ${blocksAvailable} blocks. ` +
      `Consider increasing your study time by ${additionalHours} hours per week.`
    );
  }

  // Calculate Phase 1 pace
  const modulesPerWeek = calculatePhase1Pace(inventory.modules.length, weeksUntilExam);
  const weeksForPhase1 = Math.ceil(inventory.modules.length / modulesPerWeek);

  if (weeksForPhase1 > weeksUntilExam) {
    warnings.push(
      `Warning: The number of modules (${inventory.modules.length}) is too high for the available time. ` +
      `The plan will use an accelerated pace (${modulesPerWeek} modules/week).`
    );
  }

  // Calculate Week 1 start date
  const week1StartDate = calculateWeek1StartDate(config.planCreatedAt);
  const examDate = new Date(config.examDate);
  examDate.setDate(examDate.getDate() - 1); // Don't schedule on exam day

  // Generate blocks
  const blocks: EnhancedStudyBlock[] = [];

  // Phase 1: Learn modules sequentially
  const phase1Blocks = await generatePhase1Blocks(
    inventory,
    week1StartDate,
    examDate,
    modulesPerWeek,
    config
  );
  blocks.push(...phase1Blocks);

  // Phase 2: Review (concurrent with Phase 1)
  const phase2Blocks = await generatePhase2Blocks(
    courseId,
    userId,
    inventory,
    week1StartDate,
    examDate,
    config
  );
  blocks.push(...phase2Blocks);

  // Phase 3: Practice (after Phase 1 complete)
  const phase3Blocks = await generatePhase3Blocks(
    courseId,
    inventory,
    week1StartDate,
    examDate,
    weeksForPhase1,
    config
  );
  blocks.push(...phase3Blocks);

  // Sort blocks by date and order
  blocks.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.order - b.order;
  });

  // Assign order numbers
  blocks.forEach((block, index) => {
    block.order = index;
  });

  return {
    blocks,
    warnings,
    minimumStudyTime,
    blocksAvailable,
    meetsMinimum,
  };
}

/**
 * Generate Phase 1 blocks: Learn modules sequentially
 */
async function generatePhase1Blocks(
  inventory: CourseContentInventory,
  startDate: Date,
  endDate: Date,
  modulesPerWeek: number,
  config: StudyPlanConfig
): Promise<EnhancedStudyBlock[]> {
  const blocks: EnhancedStudyBlock[] = [];
  const preferredDays = config.preferredStudyDays || [1, 2, 3, 4, 5]; // Mon-Fri

  // Prepare module content list directly from inventory to avoid redundant DB queries
  const sortedModules = [...inventory.modules].sort((a, b) => a.order - b.order);
  const moduleContentList = sortedModules.map((module) => ({
    module,
    contentItems: module.contentItemsDetailed,
    quizzes: module.quizzesDetailed,
  }));

  // Debug: Log how many modules we're processing
  console.log(`[Phase1] Processing ${moduleContentList.length} modules, modulesPerWeek: ${modulesPerWeek}`);

  // Distribute modules across weeks
  // Create individual blocks for content items (for daily plan)
  // The weekly plan component will group them by module
  let moduleIndex = 0;
  let weekNumber = 1;
  let weekStart = new Date(startDate);

  // Ensure we process ALL modules regardless of date constraints
  while (moduleIndex < moduleContentList.length) {
    // Calculate week end (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Don't schedule past exam date
    const actualWeekEnd = weekEnd > endDate ? endDate : weekEnd;

    // Get modules for this week
    const modulesThisWeek = moduleContentList.slice(
      moduleIndex,
      Math.min(moduleIndex + modulesPerWeek, moduleContentList.length)
    );

    // Debug: Log which modules we're scheduling this week
    console.log(`[Phase1] Week ${weekNumber}: Scheduling modules ${moduleIndex + 1}-${moduleIndex + modulesThisWeek.length} (${modulesThisWeek.length} modules)`);

    // Get preferred days within this week
    const weekPreferredDays: Date[] = [];
    let day = new Date(weekStart);
    while (day <= actualWeekEnd) {
      if (preferredDays.includes(day.getDay())) {
        weekPreferredDays.push(new Date(day));
      }
      day.setDate(day.getDate() + 1);
    }

    // If no preferred days in this week, still schedule modules but use any day
    if (weekPreferredDays.length === 0) {
      console.log(`[Phase1] Week ${weekNumber}: No preferred days, using any day in week`);
      // Use Monday of the week as fallback
      const monday = new Date(weekStart);
      weekPreferredDays.push(monday);
    }

    // Distribute module content across preferred days in this week
    let dayIndex = 0;
    for (const moduleContent of modulesThisWeek) {
      const moduleRecord = moduleContent.module;
      let currentDayIndex = dayIndex;
      let blocksOnCurrentDay = 0;

      console.log(`[Phase1] Week ${weekNumber}: Scheduling module ${moduleRecord.order} (${moduleRecord.title}) - ${moduleContent.contentItems.length} content items, ${moduleContent.quizzes.length} quizzes`);

      // Ensure we have at least one day to schedule on
      if (weekPreferredDays.length === 0) {
        console.error(`[Phase1] Week ${weekNumber}: No preferred days available, cannot schedule module ${moduleRecord.order}`);
        moduleIndex++;
        continue;
      }

      // Schedule all content items for this module (for daily plan)
      for (const contentItem of moduleContent.contentItems) {
        if (currentDayIndex >= weekPreferredDays.length) {
          // If we run out of days in this week, use the last day
          currentDayIndex = weekPreferredDays.length - 1;
        }

        const scheduleDate = weekPreferredDays[currentDayIndex];
        
        if (contentItem.contentType === "VIDEO") {
          blocks.push({
            date: new Date(scheduleDate),
            taskType: TaskType.LEARN,
            targetModuleId: moduleRecord.id,
            targetContentItemId: contentItem.id,
            estimatedBlocks: 2,
            order: 0, // Will be assigned later
          });
          blocksOnCurrentDay += 2;
        } else if (contentItem.contentType === "NOTE") {
          blocks.push({
            date: new Date(scheduleDate),
            taskType: TaskType.LEARN,
            targetModuleId: moduleRecord.id,
            targetContentItemId: contentItem.id,
            estimatedBlocks: 1,
            order: 0,
          });
          blocksOnCurrentDay += 1;
        }

        // Move to next day after roughly 4-6 blocks (2-3 hours of study)
        if (blocksOnCurrentDay >= 4 && currentDayIndex < weekPreferredDays.length - 1) {
          currentDayIndex++;
          blocksOnCurrentDay = 0;
        }
      }

      // Schedule quizzes at the end of module content
      if (moduleContent.quizzes.length > 0) {
        const quizDate = weekPreferredDays[Math.min(currentDayIndex, weekPreferredDays.length - 1)];
        for (const quiz of moduleContent.quizzes) {
          blocks.push({
            date: new Date(quizDate),
            taskType: TaskType.LEARN,
          targetModuleId: moduleRecord.id,
            targetQuizId: quiz.id,
            estimatedBlocks: 1,
            order: 0,
          });
        }
      }

      // CRITICAL: Always increment moduleIndex to move to next module
      moduleIndex++;
      console.log(`[Phase1] Week ${weekNumber}: Completed module ${moduleRecord.order}, moduleIndex now: ${moduleIndex}`);
      
      // Start next module on a different day to distribute load
      dayIndex = (dayIndex + 1) % weekPreferredDays.length;
    }

    // Safety check: ensure we processed all modules for this week
    if (modulesThisWeek.length === 0) {
      console.error(`[Phase1] Week ${weekNumber}: No modules to schedule, but moduleIndex: ${moduleIndex}, total modules: ${moduleContentList.length}`);
      // Break if we've processed all modules
      if (moduleIndex >= moduleContentList.length) {
        break;
      }
      // Still move to next week to avoid infinite loop
      weekStart.setDate(weekStart.getDate() + 7);
      weekNumber++;
      continue;
    }

    // Move to next week only if we haven't processed all modules
    if (moduleIndex < moduleContentList.length) {
      weekStart.setDate(weekStart.getDate() + 7);
      weekNumber++;
    }
  }

  // Ensure every module has at least one scheduled block
  const scheduledModuleIds = new Set(
    blocks
      .filter((block) => block.taskType === TaskType.LEARN && block.targetModuleId)
      .map((block) => block.targetModuleId as string)
  );

  const missingModules = sortedModules.filter(
    (module) => !scheduledModuleIds.has(module.id)
  );

  if (missingModules.length > 0) {
    console.warn(
      `[Phase1] ${missingModules.length} modules missing from schedule. Adding fallback blocks.`
    );
    let fallbackDate =
      blocks.length > 0
        ? new Date(blocks[blocks.length - 1].date)
        : new Date(startDate);
    fallbackDate.setDate(fallbackDate.getDate() + 1);

    for (const moduleRecord of missingModules) {
      const nextDate = getNextPreferredDate(fallbackDate, preferredDays);

      blocks.push({
        date: new Date(nextDate),
        taskType: TaskType.LEARN,
        targetModuleId: moduleRecord.id,
        estimatedBlocks: Math.max(moduleRecord.estimatedBlocks || 4, 4),
        order: 0,
      });

      fallbackDate = new Date(nextDate);
      fallbackDate.setDate(fallbackDate.getDate() + 1);
    }
  }

  console.log(`[Phase1] Completed: Scheduled ${blocks.length} blocks for ${moduleIndex} modules`);

  return blocks;
}

function getNextPreferredDate(date: Date, preferredDays: number[]): Date {
  const nextDate = new Date(date);
  for (let i = 0; i < 7; i++) {
    if (preferredDays.includes(nextDate.getDay())) {
      return nextDate;
    }
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
}

/**
 * Generate Phase 2 blocks: Review with spaced repetition
 * Review sessions include all learned modules
 */
async function generatePhase2Blocks(
  courseId: string,
  userId: string,
  inventory: CourseContentInventory,
  startDate: Date,
  endDate: Date,
  config: StudyPlanConfig
): Promise<EnhancedStudyBlock[]> {
  const blocks: EnhancedStudyBlock[] = [];
  const preferredDays = config.preferredStudyDays || [1, 2, 3, 4, 5];
  const spacingIntervals = getSpacingIntervals(
    getWeeksUntilExam(config.examDate, config.planCreatedAt)
  );

  // Get actual module progress to track when modules are learned
  const moduleProgress = await prisma.moduleProgress.findMany({
    where: {
      userId,
      courseId,
    },
    select: {
      moduleId: true,
      learnStatus: true,
      lastLearnedAt: true,
    },
  });

  const learnedModulesMap = new Map<string, Date>();
  for (const progress of moduleProgress) {
    if (progress.learnStatus === "LEARNED" && progress.lastLearnedAt) {
      learnedModulesMap.set(progress.moduleId, progress.lastLearnedAt);
    }
  }

  // For each module, schedule review sessions at spaced intervals
  // If module is already learned, use actual date; otherwise estimate
  for (const moduleRecord of inventory.modules) {
    let learnedDate: Date;
    
    if (learnedModulesMap.has(moduleRecord.id)) {
      // Use actual learned date
      learnedDate = learnedModulesMap.get(moduleRecord.id)!;
    } else {
      // Estimate when module will be learned (based on Phase 1 pace)
      const moduleOrder = moduleRecord.order;
      const modulesPerWeek = calculatePhase1Pace(
        inventory.modules.length,
        getWeeksUntilExam(config.examDate, config.planCreatedAt)
      );
      const weeksToLearn = Math.ceil(moduleOrder / modulesPerWeek);
      learnedDate = new Date(startDate);
      learnedDate.setDate(learnedDate.getDate() + weeksToLearn * 7);
    }

    // Schedule review sessions at spaced intervals
    for (const interval of spacingIntervals) {
      const reviewDate = new Date(learnedDate);
      reviewDate.setDate(reviewDate.getDate() + interval);

      if (reviewDate <= endDate) {
        // Get flashcards and activities for this module
        const flashcards = await prisma.flashcard.findMany({
          where: {
            courseId,
            moduleId: moduleRecord.id,
          },
          select: { id: true },
        });

        const activities = await prisma.learningActivity.findMany({
          where: {
            moduleId: moduleRecord.id,
          },
          select: { id: true },
        });

        // Get all learned modules up to this point for the review session
        const learnedModules = inventory.modules.filter((m) => {
          // Include if already learned or if order is less than current module
          return learnedModulesMap.has(m.id) || m.order <= moduleRecord.order;
        });
        
        const allFlashcardIds: string[] = [];
        const allActivityIds: string[] = [];
        const moduleFlashcardMap = new Map<string, string[]>(); // moduleId -> flashcardIds
        const moduleActivityMap = new Map<string, string[]>(); // moduleId -> activityIds

        for (const learnedModule of learnedModules) {
          const moduleFlashcards = await prisma.flashcard.findMany({
            where: {
              courseId,
              moduleId: learnedModule.id,
            },
            select: { id: true },
          });
          const flashcardIds = moduleFlashcards.map((f) => f.id);
          allFlashcardIds.push(...flashcardIds);
          moduleFlashcardMap.set(learnedModule.id, flashcardIds);

          const moduleActivities = await prisma.learningActivity.findMany({
            where: {
              moduleId: learnedModule.id,
            },
            select: { id: true },
          });
          const activityIds = moduleActivities.map((a) => a.id);
          allActivityIds.push(...activityIds);
          moduleActivityMap.set(learnedModule.id, activityIds);
        }

        // Prioritize: Minimum per module (10 flashcards + 5 activities) + difficult items + failed quiz modules
        const prioritizedFlashcardIds = await prioritizeFlashcards(
          courseId,
          userId,
          learnedModules,
          moduleFlashcardMap,
          allFlashcardIds
        );
        const prioritizedActivityIds = await prioritizeActivities(
          courseId,
          userId,
          learnedModules,
          moduleActivityMap,
          allActivityIds
        );

        // Only schedule if it's a preferred study day
        if (preferredDays.includes(reviewDate.getDay())) {
          // Store prioritized flashcards and activities
          const allReviewItems = [...prioritizedFlashcardIds, ...prioritizedActivityIds];
          
          blocks.push({
            date: reviewDate,
            taskType: TaskType.REVIEW,
            targetModuleId: module.id,
            targetFlashcardIds: allReviewItems.length > 0 ? allReviewItems : undefined,
            estimatedBlocks: 1,
            order: 0,
          });
        }
      }
    }
  }

  return blocks;
}

/**
 * Generate Phase 3 blocks: Practice (mock exams and question banks)
 * Phase 3 can only start after Phase 1 is complete
 */
async function generatePhase3Blocks(
  courseId: string,
  inventory: CourseContentInventory,
  startDate: Date,
  endDate: Date,
  weeksForPhase1: number,
  config: StudyPlanConfig
): Promise<EnhancedStudyBlock[]> {
  const blocks: EnhancedStudyBlock[] = [];
  const preferredDays = config.preferredStudyDays || [1, 2, 3, 4, 5];

  // Phase 1 completion date
  const phase1EndDate = new Date(startDate);
  phase1EndDate.setDate(phase1EndDate.getDate() + weeksForPhase1 * 7);

  // Get mock exams
  const mockExams = await prisma.quiz.findMany({
    where: {
      isMockExam: true,
      contentItem: {
        module: {
          courseId,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (mockExams.length === 0) {
    return blocks;
  }

  // Schedule mock exams
  // Last mock: Week before exam
  // Second-to-last: 2 weeks before exam
  // First: After Phase 1 completion
  const examDate = new Date(config.examDate);
  const lastMockDate = new Date(examDate);
  lastMockDate.setDate(lastMockDate.getDate() - 7); // 1 week before

  const secondToLastMockDate = new Date(examDate);
  secondToLastMockDate.setDate(secondToLastMockDate.getDate() - 14); // 2 weeks before

  // Schedule last mock exam
  if (mockExams.length > 0) {
    const lastMock = mockExams[mockExams.length - 1];
    if (lastMockDate >= phase1EndDate && lastMockDate <= endDate) {
      blocks.push({
        date: lastMockDate,
        taskType: TaskType.PRACTICE,
        targetQuizId: lastMock.id,
        estimatedBlocks: 4,
        order: 0,
      });
    }
  }

  // Schedule second-to-last mock exam
  if (mockExams.length > 1) {
    const secondToLastMock = mockExams[mockExams.length - 2];
    if (secondToLastMockDate >= phase1EndDate && secondToLastMockDate <= endDate) {
      blocks.push({
        date: secondToLastMockDate,
        taskType: TaskType.PRACTICE,
        targetQuizId: secondToLastMock.id,
        estimatedBlocks: 4,
        order: 0,
      });
    }
  }

  // Schedule remaining mock exams after Phase 1 completion
  const remainingMocks = mockExams.slice(0, -2);
  const daysBetweenMocks = Math.floor(
    (secondToLastMockDate.getTime() - phase1EndDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysPerMock = remainingMocks.length > 0 ? Math.floor(daysBetweenMocks / (remainingMocks.length + 1)) : 0;

  for (let i = 0; i < remainingMocks.length; i++) {
    const mockDate = new Date(phase1EndDate);
    mockDate.setDate(mockDate.getDate() + daysPerMock * (i + 1));

    if (mockDate <= endDate && preferredDays.includes(mockDate.getDay())) {
      blocks.push({
        date: mockDate,
        taskType: TaskType.PRACTICE,
        targetQuizId: remainingMocks[i].id,
        estimatedBlocks: 4,
        order: 0,
      });
    }
  }

  // Schedule question bank practice (more practice closer to exam)
  const questionBanks = await prisma.questionBank.findMany({
    where: { courseId },
  });

  if (questionBanks.length > 0) {
    const practiceStartDate = new Date(phase1EndDate);
    const daysForPractice = Math.floor((endDate.getTime() - practiceStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const practiceSessions = Math.min(questionBanks.length, Math.floor(daysForPractice / 3)); // ~3 days between sessions

    for (let i = 0; i < practiceSessions; i++) {
      const sessionDate = new Date(practiceStartDate);
      // More sessions closer to exam (exponential distribution)
      const progress = i / practiceSessions;
      const daysOffset = Math.floor(daysForPractice * (1 - Math.pow(1 - progress, 2)));
      sessionDate.setDate(sessionDate.getDate() + daysOffset);

      if (sessionDate <= endDate && preferredDays.includes(sessionDate.getDay())) {
        const questionBank = questionBanks[i % questionBanks.length];
        // Store question bank ID in targetFlashcardIds JSON for now
        // We can extend the schema later to add a dedicated field
        blocks.push({
          date: sessionDate,
          taskType: TaskType.PRACTICE,
          targetFlashcardIds: [questionBank.id], // Temporary: store question bank ID here
          estimatedBlocks: 1,
          order: 0,
        });
      }
    }
  }

  return blocks;
}
