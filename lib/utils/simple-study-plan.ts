/**
 * Simplified Study Plan Algorithm
 * Generates a straightforward study plan with all modules scheduled
 */

import { PrismaClient, TaskType } from "@prisma/client";
import {
  getWeeksUntilExam,
  getBlocksPerWeek,
  calculatePhase1Pace,
  calculateWeek1StartDate,
  type StudyPlanConfig,
} from "./study-plan";

const prisma = new PrismaClient();

export interface SimpleStudyBlock {
  date: Date;
  taskType: TaskType;
  targetModuleId?: string;
  targetContentItemId?: string;
  targetQuizId?: string;
  targetFlashcardIds?: string[];
  estimatedBlocks: number;
  order: number;
}

export interface SimpleStudyPlanResult {
  blocks: SimpleStudyBlock[];
  warnings: string[];
  minimumStudyTime: number;
  blocksAvailable: number;
  meetsMinimum: boolean;
}

/**
 * Generate a simple study plan with all modules scheduled
 */
export async function generateSimpleStudyPlan(
  courseId: string,
  userId: string,
  config: StudyPlanConfig
): Promise<SimpleStudyPlanResult> {
  const warnings: string[] = [];
  const blocks: SimpleStudyBlock[] = [];

  // Get all modules for the course
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      contentItems: {
        where: {
          contentType: { in: ["VIDEO", "NOTE", "QUIZ"] },
        },
        orderBy: { order: "asc" },
        include: {
          quiz: true,
        },
      },
    },
  });

  console.log(`[SimpleStudyPlan] Course ${courseId}: Found ${modules.length} modules`);

  if (modules.length === 0) {
    return {
      blocks: [],
      warnings: ["No module found in this course"],
      minimumStudyTime: 0,
      blocksAvailable: 0,
      meetsMinimum: false,
    };
  }

  // Calculate time parameters
  const weeksUntilExam = getWeeksUntilExam(config.examDate, config.planCreatedAt);
  const blocksPerWeek = getBlocksPerWeek(config.studyHoursPerWeek);
  const blocksAvailable = weeksUntilExam * blocksPerWeek;

  // Minimum study time: 4 blocks per module
  const minimumStudyTime = modules.length * 4;
  const meetsMinimum = blocksAvailable >= minimumStudyTime;

  if (!meetsMinimum) {
    const deficit = minimumStudyTime - blocksAvailable;
    const additionalHours = Math.ceil(deficit / 2);
    warnings.push(
      `Insufficient study time. Minimum required: ${minimumStudyTime} blocks, available: ${blocksAvailable} blocks. ` +
      `Consider increasing your study time by ${additionalHours} hours per week.`
    );
  }

  // Calculate pace
  const modulesPerWeek = calculatePhase1Pace(modules.length, weeksUntilExam);
  console.log(`[SimpleStudyPlan] Pace: ${modulesPerWeek} modules per week over ${weeksUntilExam} weeks`);

  // Get dates
  const week1StartDate = calculateWeek1StartDate(config.planCreatedAt);
  const examDate = new Date(config.examDate);
  examDate.setDate(examDate.getDate() - 1); // Don't schedule on exam day

  // Get preferred study days (default to weekdays: Mon-Fri = 1-5)
  const preferredDays = config.preferredStudyDays && config.preferredStudyDays.length > 0
    ? config.preferredStudyDays
    : [1, 2, 3, 4, 5];

  let blockOrder = 0;
  let moduleIndex = 0;

  // Schedule Phase 1 (LEARN) blocks - one module per week (or as pace dictates)
  for (let week = 1; week <= weeksUntilExam && moduleIndex < modules.length; week++) {
    const weekStartDate = new Date(week1StartDate);
    weekStartDate.setDate(weekStartDate.getDate() + (week - 1) * 7);

    // How many modules to schedule this week
    const modulesThisWeek = Math.min(modulesPerWeek, modules.length - moduleIndex);

    for (let m = 0; m < modulesThisWeek && moduleIndex < modules.length; m++) {
      const moduleRecord = modules[moduleIndex];
      
      // Find a preferred day for this module
      const dayOffset = preferredDays[m % preferredDays.length] || 1;
      const moduleDate = new Date(weekStartDate);
      moduleDate.setDate(moduleDate.getDate() + dayOffset);

      // Ensure date is before exam
      if (moduleDate > examDate) {
        moduleDate.setTime(examDate.getTime());
      }

      // Create LEARN block for the module
      blocks.push({
        date: new Date(moduleDate),
        taskType: TaskType.LEARN,
        targetModuleId: moduleRecord.id,
        estimatedBlocks: 4, // Standard 4 blocks per module
        order: blockOrder++,
      });

      console.log(`[SimpleStudyPlan] Week ${week}: Scheduled module ${moduleIndex} (${moduleRecord.title}) on ${moduleDate.toISOString().split('T')[0]}`);
      moduleIndex++;
    }
  }

  // Schedule Phase 2 (REVIEW) blocks - simple approach: one review session per week after learning
  const reviewStartWeek = Math.ceil(modules.length / modulesPerWeek) + 1;
  for (let week = reviewStartWeek; week <= weeksUntilExam; week++) {
    const weekStartDate = new Date(week1StartDate);
    weekStartDate.setDate(weekStartDate.getDate() + (week - 1) * 7);

    // Find a preferred day for review
    const dayOffset = preferredDays[0] || 1;
    const reviewDate = new Date(weekStartDate);
    reviewDate.setDate(reviewDate.getDate() + dayOffset);

    if (reviewDate > examDate) continue;

    blocks.push({
      date: new Date(reviewDate),
      taskType: TaskType.REVIEW,
      estimatedBlocks: 2,
      order: blockOrder++,
    });
  }

  // Schedule Phase 3 (PRACTICE) blocks - mock exams in final weeks
  const practiceWeeks = Math.max(1, Math.floor(weeksUntilExam / 4));
  for (let i = 0; i < practiceWeeks && i < 3; i++) {
    const weekFromEnd = i + 1;
    const practiceWeek = weeksUntilExam - weekFromEnd + 1;
    
    if (practiceWeek <= 0) continue;

    const weekStartDate = new Date(week1StartDate);
    weekStartDate.setDate(weekStartDate.getDate() + (practiceWeek - 1) * 7);

    // Find a preferred day for practice
    const dayOffset = preferredDays[preferredDays.length - 1] || 5;
    const practiceDate = new Date(weekStartDate);
    practiceDate.setDate(practiceDate.getDate() + dayOffset);

    if (practiceDate > examDate) continue;

    blocks.push({
      date: new Date(practiceDate),
      taskType: TaskType.PRACTICE,
      estimatedBlocks: 4,
      order: blockOrder++,
    });
  }

  // Sort blocks by date
  blocks.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.order - b.order;
  });

  // Re-assign order numbers
  blocks.forEach((block, index) => {
    block.order = index;
  });

  console.log(`[SimpleStudyPlan] Generated ${blocks.length} total blocks`);
  console.log(`[SimpleStudyPlan] LEARN blocks: ${blocks.filter(b => b.taskType === TaskType.LEARN).length}`);
  console.log(`[SimpleStudyPlan] REVIEW blocks: ${blocks.filter(b => b.taskType === TaskType.REVIEW).length}`);
  console.log(`[SimpleStudyPlan] PRACTICE blocks: ${blocks.filter(b => b.taskType === TaskType.PRACTICE).length}`);

  return {
    blocks,
    warnings,
    minimumStudyTime,
    blocksAvailable,
    meetsMinimum,
  };
}













