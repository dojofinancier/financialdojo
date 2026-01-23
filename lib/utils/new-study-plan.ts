/**
 * New Study Plan Algorithm
 * Implements the complete requirements for Phase 1, 2, and 3 with proper validation
 */

import { PrismaClient, TaskType } from "@prisma/client";
import {
  getWeeksUntilExam,
  getBlocksPerWeek,
  calculateWeek1StartDate,
  type StudyPlanConfig,
} from "./study-plan";

const prisma = new PrismaClient();

export interface NewStudyBlock {
  date: Date;
  taskType: TaskType;
  targetModuleId?: string;
  targetContentItemId?: string;
  targetQuizId?: string;
  targetFlashcardIds?: string[];
  targetActivityIds?: string[]; // For learning activities
  estimatedBlocks: number;
  order: number;
  // Off-platform items (Lecture rapide, Lecture lente) are not trackable
  // They will be shown in weekly plan but not create DailyPlanEntry
  isOffPlatform?: boolean;
}

export interface NewStudyPlanResult {
  blocks: NewStudyBlock[];
  warnings: string[];
  minimumStudyTime: number;
  blocksAvailable: number;
  meetsMinimum: boolean;
  omitPhase1: boolean;
  phase1EndWeek?: number;
  requiredHoursPerWeek?: number;
  error?: string;
}

/**
 * Get minimum hours per week based on self-rating
 */
function getMinimumHours(selfRating: "NOVICE" | "INTERMEDIATE" | "RETAKER"): number {
  // RETAKER = NOVICE (8 hours)
  if (selfRating === "INTERMEDIATE") {
    return 7;
  }
  return 8; // NOVICE and RETAKER
}

/**
 * Validate and setup study plan configuration
 */
function validateAndSetup(
  config: StudyPlanConfig,
  moduleCount: number
): {
  valid: boolean;
  omitPhase1: boolean;
  warnings: string[];
  adjustedHours?: number;
  error?: string;
} {
  const warnings: string[] = [];
  const weeksUntilExam = getWeeksUntilExam(config.examDate, config.planCreatedAt);

  // Check if exam date is in the past or today
  const examDate = new Date(config.examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  examDate.setHours(0, 0, 0, 0);

  if (examDate <= today) {
    return {
      valid: false,
      omitPhase1: false,
      warnings: [],
      error: "The exam date must be in the future. Please select another date.",
    };
  }

  // Check minimum weeks (0-3 weeks: omit Phase 1)
  if (weeksUntilExam < 4) {
    return {
      valid: true,
      omitPhase1: true,
      warnings: [
        "Less than 4 weeks before the exam. Phase 1 omitted. The plan will be divided equally between Phase 2 and Phase 3.",
      ],
    };
  }

  // Check minimum hours
  const minHours = getMinimumHours(config.selfRating);
  if (config.studyHoursPerWeek < minHours) {
    warnings.push(
      `Minimum ${minHours} hours/week required for ${config.selfRating}. The hours have been adjusted to ${minHours}.`
    );
    return {
      valid: true,
      omitPhase1: false,
      warnings,
      adjustedHours: minHours,
    };
  }

  // Check long exam date (>15 weeks)
  if (weeksUntilExam > 15) {
    warnings.push(
      "Consider 8 to 12 weeks for best results. You can change your exam date or continue with the current date."
    );
  }

  return {
    valid: true,
    omitPhase1: false,
    warnings,
  };
}

/**
 * Calculate Phase 1 requirements and check deadline
 */
function calculatePhase1Requirements(
  moduleCount: number,
  weeksUntilExam: number,
  studyHoursPerWeek: number
): {
  totalPhase1Blocks: number;
  weeksForPhase1: number;
  phase1BlocksPerWeek: number;
  phase2BlocksPerWeek: number;
  requiredHoursPerWeek?: number;
  warning?: string;
  suggestChangeExamDate?: boolean;
} {
  const blocksPerModule = 8; // Lecture rapide (1) + Video (2) + Lecture lente (3) + Notes (1) + Quiz (1)
  const totalPhase1Blocks = moduleCount * blocksPerModule;

  // Phase 1 must finish by end of week that is 2 weeks before exam
  const weeksForPhase1 = weeksUntilExam - 2;

  if (weeksForPhase1 <= 0) {
    return {
      totalPhase1Blocks,
      weeksForPhase1: 0,
      phase1BlocksPerWeek: 0,
      phase2BlocksPerWeek: 0,
      warning: "Not enough time to complete Phase 1.",
    };
  }

  // Calculate required hours per week for Phase 1
  // 80% allocation to Phase 1, 20% to Phase 2
  const blocksPerWeek = studyHoursPerWeek * 2; // Convert hours to blocks
  const phase1BlocksPerWeek = Math.max(1, Math.floor(blocksPerWeek * 0.8)); // 80% for Phase 1
  const phase2BlocksPerWeek = Math.max(1, blocksPerWeek - phase1BlocksPerWeek); // Remaining 20% for Phase 2
  
  // Check if we can complete Phase 1 in the available weeks
  const totalPhase1BlocksNeeded = totalPhase1Blocks;
  const phase1BlocksAvailable = phase1BlocksPerWeek * weeksForPhase1;
  
  if (phase1BlocksAvailable < totalPhase1BlocksNeeded) {
    // Need more hours
    const requiredBlocksPerWeek = Math.ceil(totalPhase1BlocksNeeded / weeksForPhase1);
    const requiredHoursPerWeek = Math.ceil(requiredBlocksPerWeek / 2);
    
    return {
      totalPhase1Blocks,
      weeksForPhase1,
      phase1BlocksPerWeek,
      phase2BlocksPerWeek: Math.max(1, Math.floor(requiredHoursPerWeek * 2 * 0.2)), // Ensure at least 1 block
      requiredHoursPerWeek,
      warning: `You need ${requiredHoursPerWeek} hours/week to complete Phase 1.`,
      suggestChangeExamDate: true,
    };
  }

  return {
    totalPhase1Blocks,
    weeksForPhase1,
    phase1BlocksPerWeek,
    phase2BlocksPerWeek: Math.max(1, phase2BlocksPerWeek), // Ensure at least 1 block per week
  };
}

/**
 * Get week start date (Monday)
 */
function getWeekStart(week1StartDate: Date, weekNumber: number): Date {
  const weekStart = new Date(week1StartDate);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get preferred date within a week
 */
function getPreferredDate(weekStart: Date, preferredDays: number[]): Date {
  // Find first preferred day in the week
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    if (preferredDays.includes(date.getDay())) {
      return date;
    }
  }
  // Fallback to Monday
  return new Date(weekStart);
}

/**
 * Generate Phase 1 blocks
 * Order per module: Lecture rapide (1) → Video (2) → Lecture lente (3) → Notes (1) → Quiz (1)
 */
async function generatePhase1Blocks(
  courseId: string,
  week1StartDate: Date,
  weeksForPhase1: number,
  phase1BlocksPerWeek: number,
  preferredDays: number[],
  examDate: Date,
  videosEnabled: boolean = true
): Promise<NewStudyBlock[]> {
  const blocks: NewStudyBlock[] = [];

  // Calculate Phase 1 end date (end of week that is 2 weeks before exam)
  // If exam is in week 13, Phase 1 ends at end of week 11
  const phase1EndWeek = weeksForPhase1;
  const phase1EndWeekStart = getWeekStart(week1StartDate, phase1EndWeek);
  const phase1EndDate = new Date(phase1EndWeekStart);
  phase1EndDate.setDate(phase1EndWeekStart.getDate() + 6); // End of week (Sunday)
  phase1EndDate.setHours(23, 59, 59, 999);
  
  console.log(`[generatePhase1Blocks] Phase 1 end week: ${phase1EndWeek}, end date: ${phase1EndDate.toISOString()}`);

  // Get all modules with content (do not rely only on contentType)
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      contentItems: {
        orderBy: { order: "asc" },
        include: {
          quiz: true,
          video: true,
          notes: true,
        },
      },
    },
  });

  if (modules.length === 0) {
    return blocks;
  }

  // Distribute modules across weeks
  // Ensure we schedule ALL modules, even if it means going slightly past the ideal end date
  const modulesPerWeek = Math.max(1, Math.ceil(modules.length / weeksForPhase1));
  let moduleIndex = 0;

  console.log(`[generatePhase1Blocks] Scheduling ${modules.length} modules over ${weeksForPhase1} weeks (${modulesPerWeek} modules/week)`);

  for (let week = 1; week <= weeksForPhase1 && moduleIndex < modules.length; week++) {
    const weekStart = getWeekStart(week1StartDate, week);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Don't schedule past Phase 1 end date, but ensure we schedule all modules
    // If we're at the last week and still have modules, schedule them anyway
    if (weekStart > phase1EndDate && week < weeksForPhase1) {
      console.log(`[generatePhase1Blocks] Week ${week} is past Phase 1 end date, but continuing to schedule remaining modules`);
      // Continue to ensure all modules are scheduled
    }

    const modulesThisWeek = modules.slice(
      moduleIndex,
      Math.min(moduleIndex + modulesPerWeek, modules.length)
    );

    for (const moduleRecord of modulesThisWeek) {
      // Identify content by relations or contentType as fallback
      // Only include videos if they are enabled in componentVisibility
      const videos = videosEnabled
        ? moduleRecord.contentItems.filter(
            (c) => c.video || c.contentType === "VIDEO"
          )
        : [];
      const notes = moduleRecord.contentItems.filter(
        (c) => (c.notes && c.notes.length > 0) || c.contentType === "NOTE"
      );
      const quizzes = moduleRecord.contentItems.filter(
        (c) => (c.quiz && !c.quiz.isMockExam) || c.contentType === "QUIZ"
      );

      console.log(
        `[generatePhase1Blocks] Module ${moduleRecord.title}: ${videos.length} videos (enabled: ${videosEnabled}), ${notes.length} notes, ${quizzes.length} quizzes`
      );

      // Get preferred date for this week, but ensure it's before Phase 1 end date
      let scheduleDate = getPreferredDate(weekStart, preferredDays);
      if (scheduleDate > phase1EndDate) {
        scheduleDate = new Date(phase1EndDate);
      }

      // 1. Lecture rapide (1 block) - off platform, but create entry so it's checkable
      blocks.push({
        date: new Date(scheduleDate),
        taskType: TaskType.LEARN,
        targetModuleId: moduleRecord.id,
        targetContentItemId: `lecture-rapide-${moduleRecord.id}`, // Special ID pattern for lecture rapide
        estimatedBlocks: 1,
        order: 0,
        isOffPlatform: true,
      });

      // 2. Videos (2 blocks each) - only if videos are enabled
      // Skip video blocks entirely if videos are disabled
      if (videosEnabled) {
        if (videos.length === 0) {
          blocks.push({
            date: new Date(scheduleDate),
            taskType: TaskType.LEARN,
            targetModuleId: moduleRecord.id,
            targetContentItemId: `video-placeholder-${moduleRecord.id}`,
            estimatedBlocks: 2,
            order: 0,
          });
        } else {
          for (const video of videos) {
            if (scheduleDate <= phase1EndDate) {
              blocks.push({
                date: new Date(scheduleDate),
                taskType: TaskType.LEARN,
                targetModuleId: moduleRecord.id,
                targetContentItemId: video.id,
                estimatedBlocks: 2,
                order: 0,
              });
            }
          }
        }
      }

      // 3. Lecture lente (3 blocks) - off platform, but create entry so it's checkable
      blocks.push({
        date: new Date(scheduleDate),
        taskType: TaskType.LEARN,
        targetModuleId: moduleRecord.id,
        targetContentItemId: `lecture-lente-${moduleRecord.id}`, // Special ID pattern for lecture lente
        estimatedBlocks: 3,
        order: 0,
        isOffPlatform: true,
      });

      // 4. Notes (1 block each) - if none, create a placeholder
      if (notes.length === 0) {
        blocks.push({
          date: new Date(scheduleDate),
          taskType: TaskType.LEARN,
          targetModuleId: moduleRecord.id,
          targetContentItemId: `notes-placeholder-${moduleRecord.id}`,
          estimatedBlocks: 1,
          order: 0,
        });
      } else {
        for (const note of notes) {
          if (scheduleDate <= phase1EndDate) {
            blocks.push({
              date: new Date(scheduleDate),
              taskType: TaskType.LEARN,
              targetModuleId: moduleRecord.id,
              targetContentItemId: note.id,
              estimatedBlocks: 1,
              order: 0,
            });
          }
        }
      }

      // 5. Quizzes (1 block each) - if none, create a placeholder
      if (quizzes.length === 0) {
        blocks.push({
          date: new Date(scheduleDate),
          taskType: TaskType.LEARN,
          targetModuleId: moduleRecord.id,
          targetQuizId: `quiz-placeholder-${moduleRecord.id}`,
          estimatedBlocks: 1,
          order: 0,
        });
      } else {
        for (const quiz of quizzes) {
          if (quiz.quiz && scheduleDate <= phase1EndDate) {
            blocks.push({
              date: new Date(scheduleDate),
              taskType: TaskType.LEARN,
              targetModuleId: moduleRecord.id,
              targetQuizId: quiz.quiz.id,
              estimatedBlocks: 1,
              order: 0,
            });
          }
        }
      }
    }

    moduleIndex += modulesThisWeek.length;
  }

  return blocks;
}

/**
 * Generate Phase 2 blocks
 * 50% flashcards, 50% activities
 * Starts week 2 if ≥6 weeks, otherwise week 1
 */
async function generatePhase2Blocks(
  courseId: string,
  week1StartDate: Date,
  examDate: Date,
  weeksUntilExam: number,
  phase2BlocksPerWeek: number,
  phase1EndWeek: number,
  preferredDays: number[]
): Promise<NewStudyBlock[]> {
  const blocks: NewStudyBlock[] = [];

  // Phase 2 starts week 2 if ≥6 weeks, otherwise week 1
  const phase2StartWeek = weeksUntilExam >= 6 ? 2 : 1;

  // Phase 2 continues until exam week
  const phase2EndWeek = weeksUntilExam;

  // Split 50/50 between flashcards and activities (at least 1 each if any)
  const flashcardBlocksPerWeek = Math.max(1, Math.floor(phase2BlocksPerWeek * 0.5));
  const activityBlocksPerWeek = Math.max(1, phase2BlocksPerWeek - flashcardBlocksPerWeek);

  console.log(`[generatePhase2Blocks] Phase 2: ${phase2StartWeek} to ${phase2EndWeek}, ${flashcardBlocksPerWeek} flashcard + ${activityBlocksPerWeek} activity blocks/week`);

  for (let week = phase2StartWeek; week <= phase2EndWeek; week++) {
    const weekStart = getWeekStart(week1StartDate, week);

    // Schedule flashcard sessions
    for (let i = 0; i < flashcardBlocksPerWeek; i++) {
      const sessionDate = getPreferredDate(weekStart, preferredDays);
      // Ensure date is before exam
      if (sessionDate <= examDate) {
        blocks.push({
          date: new Date(sessionDate),
          taskType: TaskType.REVIEW,
          targetFlashcardIds: [], // Will be populated by Smart Review
          estimatedBlocks: 1,
          order: 0,
        });
      }
    }

    // Schedule activity sessions
    for (let i = 0; i < activityBlocksPerWeek; i++) {
      const sessionDate = getPreferredDate(weekStart, preferredDays);
      // Ensure date is before exam
      if (sessionDate <= examDate) {
        blocks.push({
          date: new Date(sessionDate),
          taskType: TaskType.REVIEW,
          targetActivityIds: [], // Will be populated by Smart Review
          estimatedBlocks: 1,
          order: 0,
        });
      }
    }
  }

  console.log(`[generatePhase2Blocks] Generated ${blocks.length} Phase 2 blocks`);
  return blocks;
}

/**
 * Generate Phase 3 blocks
 * First exam: Week after Phase 1 (next full week)
 * Last exam: Week before exam
 * Others: Spread evenly in between
 */
async function generatePhase3Blocks(
  courseId: string,
  week1StartDate: Date,
  examDate: Date,
  weeksUntilExam: number,
  phase3BlocksPerWeek: number,
  phase1EndWeek: number,
  preferredDays: number[]
): Promise<NewStudyBlock[]> {
  const blocks: NewStudyBlock[] = [];

  // Get practice exams (mock exams) via contentItem -> module -> course
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
    include: {
      contentItem: {
        include: {
          module: true,
        },
      },
    },
  });

  // First exam: Week after Phase 1 (next full week, Monday)
  const firstExamWeek = phase1EndWeek + 1;
  const firstExamDate = getWeekStart(week1StartDate, firstExamWeek);

  // Last exam: Week before exam
  const lastExamWeek = weeksUntilExam - 1;
  const lastExamDate = getWeekStart(week1StartDate, lastExamWeek);

  // Schedule first exam
  if (mockExams.length > 0 && firstExamWeek <= lastExamWeek) {
    blocks.push({
      date: firstExamDate,
      taskType: TaskType.PRACTICE,
      targetQuizId: mockExams[0].id,
      estimatedBlocks: 4,
      order: 0,
    });
  }

  // Schedule last exam
  if (mockExams.length > 1 && lastExamWeek > firstExamWeek) {
    blocks.push({
      date: lastExamDate,
      taskType: TaskType.PRACTICE,
      targetQuizId: mockExams[mockExams.length - 1].id,
      estimatedBlocks: 4,
      order: 0,
    });
  }

  // Schedule remaining exams evenly in between
  const remainingExams = mockExams.slice(1, -1);
  if (remainingExams.length > 0 && lastExamWeek > firstExamWeek) {
    const weeksBetween = lastExamWeek - firstExamWeek;
    const spacing = Math.floor(weeksBetween / (remainingExams.length + 1));

    for (let i = 0; i < remainingExams.length; i++) {
      const examWeek = firstExamWeek + spacing * (i + 1);
      if (examWeek < lastExamWeek) {
        const examDate = getWeekStart(week1StartDate, examWeek);
        blocks.push({
          date: examDate,
          taskType: TaskType.PRACTICE,
          targetQuizId: remainingExams[i].id,
          estimatedBlocks: 4,
          order: 0,
        });
      }
    }
  }

  // Schedule quiz sessions for remaining Phase 3 blocks
  // Calculate how many quiz sessions we need
  const examBlocks = blocks.length * 4; // Each exam is 4 blocks
  const remainingBlocks = Math.max(0, phase3BlocksPerWeek * (weeksUntilExam - phase1EndWeek) - examBlocks);
  const quizSessionsNeeded = Math.floor(remainingBlocks);

  // Distribute quiz sessions across weeks after Phase 1
  for (let week = phase1EndWeek + 1; week <= weeksUntilExam; week++) {
    const weekStart = getWeekStart(week1StartDate, week);
    const sessionsThisWeek = Math.floor(quizSessionsNeeded / (weeksUntilExam - phase1EndWeek));
    
    for (let i = 0; i < sessionsThisWeek; i++) {
      blocks.push({
        date: getPreferredDate(weekStart, preferredDays),
        taskType: TaskType.PRACTICE,
        estimatedBlocks: 1,
        order: 0,
      });
    }
  }

  return blocks;
}

/**
 * Generate new study plan with all requirements
 */
export async function generateNewStudyPlan(
  courseId: string,
  userId: string,
  config: StudyPlanConfig
): Promise<NewStudyPlanResult> {
  const warnings: string[] = [];

  // Get course to check componentVisibility
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { componentVisibility: true },
  });

  // Get component visibility settings (default to enabled if not set)
  const componentVisibility = course?.componentVisibility as any || {};
  const videosEnabled = componentVisibility.videos !== false; // Default to true if not set

  // Get modules
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
  });

  if (modules.length === 0) {
    return {
      blocks: [],
      warnings: ["No module found in this course"],
      minimumStudyTime: 0,
      blocksAvailable: 0,
      meetsMinimum: false,
      omitPhase1: false,
    };
  }

  // Validate and setup
  const validation = validateAndSetup(config, modules.length);
  if (!validation.valid) {
    return {
      blocks: [],
      warnings: validation.warnings,
      minimumStudyTime: 0,
      blocksAvailable: 0,
      meetsMinimum: false,
      omitPhase1: false,
      error: validation.error,
    };
  }

  warnings.push(...validation.warnings);

  // Use adjusted hours if provided
  const studyHoursPerWeek = validation.adjustedHours || config.studyHoursPerWeek;
  const weeksUntilExam = getWeeksUntilExam(config.examDate, config.planCreatedAt);
  const blocksPerWeek = getBlocksPerWeek(studyHoursPerWeek);
  const blocksAvailable = weeksUntilExam * blocksPerWeek;

  // Calculate Week 1 start date
  const week1StartDate = calculateWeek1StartDate(config.planCreatedAt);
  const examDate = new Date(config.examDate);
  examDate.setHours(23, 59, 59, 999);

  // Get preferred study days
  const preferredDays = config.preferredStudyDays || [1, 2, 3, 4, 5]; // Mon-Fri

  const blocks: NewStudyBlock[] = [];
  let phase1EndWeek: number | undefined;
  let requiredHoursPerWeek: number | undefined;

  // Handle 0-3 weeks scenario (no Phase 1)
  if (validation.omitPhase1) {
    // 50% Phase 2, 50% Phase 3
    const phase2BlocksPerWeek = Math.floor(blocksPerWeek * 0.5);
    const phase3BlocksPerWeek = blocksPerWeek - phase2BlocksPerWeek;

    const phase2Blocks = await generatePhase2Blocks(
      courseId,
      week1StartDate,
      examDate,
      weeksUntilExam,
      phase2BlocksPerWeek,
      0, // No Phase 1
      preferredDays
    );
    blocks.push(...phase2Blocks);

    const phase3Blocks = await generatePhase3Blocks(
      courseId,
      week1StartDate,
      examDate,
      weeksUntilExam,
      phase3BlocksPerWeek,
      0, // No Phase 1, Phase 3 can start immediately
      preferredDays
    );
    blocks.push(...phase3Blocks);
  } else {
    // Normal flow: Phase 1 → Phase 2 → Phase 3

    // Calculate Phase 1 requirements
    const phase1Req = calculatePhase1Requirements(
      modules.length,
      weeksUntilExam,
      studyHoursPerWeek
    );

    if (phase1Req.warning) {
      warnings.push(phase1Req.warning);
      if (phase1Req.requiredHoursPerWeek) {
        warnings.push(
          `Consider increasing your study hours to ${phase1Req.requiredHoursPerWeek} hours/week or adjusting your exam date.`
        );
      }
    }

    phase1EndWeek = phase1Req.weeksForPhase1;
    requiredHoursPerWeek = phase1Req.requiredHoursPerWeek;

    // Generate Phase 1 blocks (80% allocation)
    const phase1Blocks = await generatePhase1Blocks(
      courseId,
      week1StartDate,
      phase1Req.weeksForPhase1,
      phase1Req.phase1BlocksPerWeek,
      preferredDays,
      examDate,
      videosEnabled
    );
    console.log(`[generateNewStudyPlan] Phase 1: Generated ${phase1Blocks.length} blocks`);
    console.log(`[generateNewStudyPlan] Phase 1 blocks breakdown:`, {
      videos: phase1Blocks.filter(b => b.estimatedBlocks === 2 && b.targetContentItemId).length,
      notes: phase1Blocks.filter(b => b.estimatedBlocks === 1 && b.targetContentItemId && !b.targetQuizId).length,
      quizzes: phase1Blocks.filter(b => b.targetQuizId).length,
    });
    blocks.push(...phase1Blocks);

    // Generate Phase 2 blocks (20% until Phase 1 complete, then 60%)
    // For now, we'll generate Phase 2 blocks for all weeks
    // The allocation will be handled when displaying the plan
    const phase2BlocksPerWeek = phase1Req.phase2BlocksPerWeek;
    console.log(`[generateNewStudyPlan] Phase 2: Generating blocks with ${phase2BlocksPerWeek} blocks/week`);
    const phase2Blocks = await generatePhase2Blocks(
      courseId,
      week1StartDate,
      examDate,
      weeksUntilExam,
      phase2BlocksPerWeek,
      phase1EndWeek,
      preferredDays
    );
    console.log(`[generateNewStudyPlan] Phase 2: Generated ${phase2Blocks.length} blocks`);
    blocks.push(...phase2Blocks);

    // Generate Phase 3 blocks (40% after Phase 1 complete)
    const phase3BlocksPerWeek = Math.floor(blocksPerWeek * 0.4);
    const phase3Blocks = await generatePhase3Blocks(
      courseId,
      week1StartDate,
      examDate,
      weeksUntilExam,
      phase3BlocksPerWeek,
      phase1EndWeek,
      preferredDays
    );
    blocks.push(...phase3Blocks);
  }

  // Sort blocks by date and assign order
  blocks.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.order - b.order;
  });

  blocks.forEach((block, index) => {
    block.order = index;
  });

  console.log(`[generateNewStudyPlan] Total blocks generated: ${blocks.length}`);
  console.log(`[generateNewStudyPlan] Block type breakdown:`, {
    LEARN: blocks.filter(b => b.taskType === TaskType.LEARN).length,
    REVIEW: blocks.filter(b => b.taskType === TaskType.REVIEW).length,
    PRACTICE: blocks.filter(b => b.taskType === TaskType.PRACTICE).length,
  });

  // Calculate minimum study time
  // Get mock exam count via contentItem -> module -> course
  // Wrap in try-catch to prevent crashes if query fails
  let mockExamCount = 0;
  try {
    mockExamCount = await prisma.quiz.count({
      where: {
        isMockExam: true,
        contentItem: {
          module: {
            courseId,
          },
        },
      },
    });
    console.log(`[generateNewStudyPlan] Found ${mockExamCount} mock exams`);
  } catch (error) {
    console.error(`[generateNewStudyPlan] Error counting mock exams:`, error);
    // Continue with 0 mock exams if query fails
  }
  const minimumStudyTime = modules.length * 8 + mockExamCount * 4;

  return {
    blocks,
    warnings,
    minimumStudyTime,
    blocksAvailable,
    meetsMinimum: blocksAvailable >= minimumStudyTime,
    omitPhase1: validation.omitPhase1,
    phase1EndWeek,
    requiredHoursPerWeek,
  };
}
