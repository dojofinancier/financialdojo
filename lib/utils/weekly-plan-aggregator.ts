/**
 * Weekly Plan Aggregator
 * Aggregates daily plan entries into weekly tasks with proper formatting
 */

import { DailyPlanEntry, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface WeeklyPlanTask {
  type: "LEARN" | "REVIEW" | "PRACTICE";
  description: string;
  moduleId?: string;
  moduleTitle?: string;
  moduleNumber?: number;
  itemCount?: number; // For flashcards/review sessions
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  isOffPlatform?: boolean; // For quick read and deep read
  entryIds?: string[]; // IDs of DailyPlanEntry records that make up this task
}

export interface WeeklyPlanWeek {
  weekNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  tasks: WeeklyPlanTask[];
  phase: "LEARN" | "REVIEW" | "PRACTICE" | "MIXED";
  estimatedBlocks: number;
  completedTasks: number;
  totalTasks: number;
}

/**
 * Aggregate daily entries into weekly tasks
 */
export async function aggregateWeeklyTasks(
  dailyEntries: DailyPlanEntry[],
  modules: Array<{ id: string; title: string; order: number }>,
  week1StartDate: Date,
  examDate?: Date,
  phase1EndWeek?: number
): Promise<WeeklyPlanWeek[]> {
  // Group entries by week
  const weeksMap = new Map<number, DailyPlanEntry[]>();

  dailyEntries.forEach((entry) => {
    const weekNumber = getWeekNumber(entry.date, week1StartDate);

    // Filter out Phase 1 entries after Phase 1 end week
    if (phase1EndWeek && entry.taskType === TaskType.LEARN && weekNumber > phase1EndWeek) {
      return; // Skip Phase 1 entries after Phase 1 end week
    }

    if (!weeksMap.has(weekNumber)) {
      weeksMap.set(weekNumber, []);
    }
    weeksMap.get(weekNumber)!.push(entry);
  });

  // Aggregate each week
  const weeks: WeeklyPlanWeek[] = [];

  for (const [weekNumber, entries] of weeksMap.entries()) {
    const weekStart = getWeekStart(week1StartDate, weekNumber);
    const weekEnd = getWeekEnd(week1StartDate, weekNumber);

    // Aggregate tasks
    const learnTasks = await aggregateLearnTasks(entries, modules);
    const reviewTasks = aggregateReviewTasks(entries);
    const practiceTasks = await aggregatePracticeTasks(entries);

    const allTasks = [...learnTasks, ...reviewTasks, ...practiceTasks];

    // Determine phase
    const phase = determinePhase(learnTasks, reviewTasks, practiceTasks);

    // Calculate statistics
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
    const estimatedBlocks = entries.reduce((sum, e) => sum + e.estimatedBlocks, 0);

    weeks.push({
      weekNumber,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      tasks: allTasks,
      phase,
      estimatedBlocks,
      completedTasks,
      totalTasks,
    });
  }

  // Sort by week number
  weeks.sort((a, b) => a.weekNumber - b.weekNumber);

  return weeks;
}

/**
 * Aggregate LEARN tasks by module
 * Format: "Quick read [module]", "Video [module]", "Deep read [module]", "Notes [module]", "Quiz [module]"
 */
async function aggregateLearnTasks(
  entries: DailyPlanEntry[],
  modules: Array<{ id: string; title: string; order: number }>
): Promise<WeeklyPlanTask[]> {
  const tasks: WeeklyPlanTask[] = [];
  const learnEntries = entries.filter((e) => e.taskType === TaskType.LEARN);

  console.log(`[aggregateLearnTasks] Found ${learnEntries.length} learn entries`);

  // Group by module
  const moduleMap = new Map<string, DailyPlanEntry[]>();

  learnEntries.forEach((entry) => {
    if (!entry.targetModuleId) return;
    if (!moduleMap.has(entry.targetModuleId)) {
      moduleMap.set(entry.targetModuleId, []);
    }
    moduleMap.get(entry.targetModuleId)!.push(entry);
  });

  console.log(`[aggregateLearnTasks] Grouped into ${moduleMap.size} modules`);

  // Get Prisma client to check content types


  // Process each module
  for (const [moduleId, moduleEntries] of moduleMap.entries()) {
    const moduleRecord = modules.find((m) => m.id === moduleId);
    if (!moduleRecord) continue;

    // Each task will have its own status based on its specific entries
    // We'll determine status per task type below

    // Check what content items we have
    // Videos: entries with targetContentItemId, estimatedBlocks === 2, no targetQuizId
    // Notes: entries with targetContentItemId, estimatedBlocks === 1, no targetQuizId
    // Quizzes: entries with targetQuizId

    const hasVideo = moduleEntries.some(
      (e) => e.targetContentItemId && e.estimatedBlocks === 2 && !e.targetQuizId
    );
    const hasNotes = moduleEntries.some(
      (e) => e.targetContentItemId && e.estimatedBlocks === 1 && !e.targetQuizId
    );

    console.log(`[aggregateLearnTasks] Module ${moduleRecord.title}: hasVideo=${hasVideo}, hasNotes=${hasNotes}, entries=${moduleEntries.length}`);

    const hasQuiz = moduleEntries.some((e) => e.targetQuizId);

    // Get entry IDs for each type
    const videoEntries = moduleEntries.filter(
      (e) => e.targetContentItemId && e.estimatedBlocks === 2 && !e.targetQuizId
    );
    const notesEntries = moduleEntries.filter(
      (e) => e.targetContentItemId && e.estimatedBlocks === 1 && !e.targetQuizId
    );
    const quizEntries = moduleEntries.filter((e) => e.targetQuizId);

    // Helper function to determine status for specific entries
    const getStatusForEntries = (entries: typeof moduleEntries) => {
      if (entries.length === 0) return "PENDING";
      if (entries.every((e) => e.status === "COMPLETED")) return "COMPLETED";
      if (entries.some((e) => e.status === "IN_PROGRESS")) return "IN_PROGRESS";
      return "PENDING";
    };

    // Get lecture rapide/lente entries (placeholder entries with special contentItemId pattern)
    const lectureRapideEntries = moduleEntries.filter(
      (e) => e.targetContentItemId?.startsWith("lecture-rapide-")
    );
    const lectureLenteEntries = moduleEntries.filter(
      (e) => e.targetContentItemId?.startsWith("lecture-lente-")
    );

    // Add tasks in order:
    // 1. Quick read (off-platform, but checkable if entry exists)
    tasks.push({
      type: "LEARN",
      description: `Quick read ${moduleRecord.title}`,
      moduleId: moduleRecord.id,
      moduleTitle: moduleRecord.title,
      moduleNumber: moduleRecord.order,
      status: lectureRapideEntries.length > 0 ? getStatusForEntries(lectureRapideEntries) : "PENDING",
      isOffPlatform: true,
      entryIds: lectureRapideEntries.map(e => e.id),
    });

    // 2. Video (if has video content)
    if (hasVideo) {
      tasks.push({
        type: "LEARN",
        description: `Video ${moduleRecord.title}`,
        moduleId: moduleRecord.id,
        moduleTitle: moduleRecord.title,
        moduleNumber: moduleRecord.order,
        status: getStatusForEntries(videoEntries),
        entryIds: videoEntries.map(e => e.id),
      });
    }

    // 3. Deep read (off-platform, but checkable if entry exists)
    tasks.push({
      type: "LEARN",
      description: `Deep read ${moduleRecord.title}`,
      moduleId: moduleRecord.id,
      moduleTitle: moduleRecord.title,
      moduleNumber: moduleRecord.order,
      status: lectureLenteEntries.length > 0 ? getStatusForEntries(lectureLenteEntries) : "PENDING",
      isOffPlatform: true,
      entryIds: lectureLenteEntries.map(e => e.id),
    });

    // 4. Notes (if has notes content)
    if (hasNotes) {
      tasks.push({
        type: "LEARN",
        description: `Notes ${moduleRecord.title}`,
        moduleId: moduleRecord.id,
        moduleTitle: moduleRecord.title,
        moduleNumber: moduleRecord.order,
        status: getStatusForEntries(notesEntries),
        entryIds: notesEntries.map(e => e.id),
      });
    }

    // 5. Quiz (if has quiz)
    if (hasQuiz) {
      tasks.push({
        type: "LEARN",
        description: `Quiz ${moduleRecord.title}`,
        moduleId: moduleRecord.id,
        moduleTitle: moduleRecord.title,
        moduleNumber: moduleRecord.order,
        status: getStatusForEntries(quizEntries),
        entryIds: quizEntries.map(e => e.id),
      });
    }
  }

  return tasks;
}

/**
 * Aggregate REVIEW tasks
 * Format: "X flashcard sessions (or smart review)"
 * Format: "X learning activity sessions (or smart review)"
 */
function aggregateReviewTasks(entries: DailyPlanEntry[]): WeeklyPlanTask[] {
  const tasks: WeeklyPlanTask[] = [];
  const reviewEntries = entries.filter((e) => e.taskType === TaskType.REVIEW);

  console.log(`[aggregateReviewTasks] Found ${reviewEntries.length} review entries out of ${entries.length} total entries`);

  if (reviewEntries.length === 0) {
    console.log(`[aggregateReviewTasks] No review entries, returning empty tasks`);
    return tasks;
  }

  // Split review entries 50/50 between flashcards and activities
  // Since we generate Phase 2 with 50/50 split, we'll split them evenly
  const totalSessions = reviewEntries.length;
  const flashcardCount = Math.ceil(totalSessions / 2);
  const activityCount = totalSessions - flashcardCount;

  console.log(`[aggregateReviewTasks] Splitting ${totalSessions} sessions: ${flashcardCount} flashcards, ${activityCount} activities`);

  // Determine status
  const allCompleted = reviewEntries.every((e) => e.status === "COMPLETED");
  const anyInProgress = reviewEntries.some((e) => e.status === "IN_PROGRESS");
  const status = allCompleted ? "COMPLETED" : anyInProgress ? "IN_PROGRESS" : "PENDING";

  // Split entries into flashcards (first half) and activities (second half)
  const flashcardEntries = reviewEntries.slice(0, flashcardCount);
  const activityEntries = reviewEntries.slice(flashcardCount);

  // Add flashcard sessions (always show if there are any review entries)
  if (flashcardCount > 0) {
    tasks.push({
      type: "REVIEW",
      description: `${flashcardCount} flashcard session${flashcardCount > 1 ? "s" : ""} (or smart review)`,
      itemCount: flashcardCount,
      status,
      entryIds: flashcardEntries.map(e => e.id),
    });
  }

  // Add activity sessions (always show if there are any review entries)
  if (activityCount > 0) {
    tasks.push({
      type: "REVIEW",
      description: `${activityCount} learning activity session${activityCount > 1 ? "s" : ""} (or smart review)`,
      itemCount: activityCount,
      status,
      entryIds: activityEntries.map(e => e.id),
    });
  }

  return tasks;
}

/**
 * Aggregate PRACTICE tasks
 * Format: Practice exam names (itemized)
 * Format: "X quiz sessions" (aggregated)
 */
async function aggregatePracticeTasks(entries: DailyPlanEntry[]): Promise<WeeklyPlanTask[]> {
  const tasks: WeeklyPlanTask[] = [];
  const practiceEntries = entries.filter((e) => e.taskType === TaskType.PRACTICE);

  if (practiceEntries.length === 0) {
    return tasks;
  }

  // Separate practice exams (with targetQuizId) from quiz sessions (without targetQuizId)
  const examEntries = practiceEntries.filter((e) => e.targetQuizId);
  const quizSessionEntries = practiceEntries.filter((e) => !e.targetQuizId);

  // Get exam names


  for (const entry of examEntries) {
    if (!entry.targetQuizId) continue;

    try {
      const exam = await prisma.quiz.findUnique({
        where: { id: entry.targetQuizId },
        select: { title: true },
      });

      const status =
        entry.status === "COMPLETED"
          ? "COMPLETED"
          : entry.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "PENDING";

      tasks.push({
        type: "PRACTICE",
        description: exam?.title || "Practice exam",
        status,
        entryIds: [entry.id],
      });
    } catch (error) {
      console.error(`Error fetching exam ${entry.targetQuizId}:`, error);
      // Add generic exam task
      tasks.push({
        type: "PRACTICE",
        description: "Practice exam",
        status: entry.status === "COMPLETED" ? "COMPLETED" : "PENDING",
        entryIds: [entry.id],
      });
    }
  }

  // Aggregate quiz sessions
  if (quizSessionEntries.length > 0) {
    const allCompleted = quizSessionEntries.every((e) => e.status === "COMPLETED");
    const anyInProgress = quizSessionEntries.some((e) => e.status === "IN_PROGRESS");
    const status = allCompleted ? "COMPLETED" : anyInProgress ? "IN_PROGRESS" : "PENDING";

    tasks.push({
      type: "PRACTICE",
      description: `${quizSessionEntries.length} quiz session${quizSessionEntries.length > 1 ? "s" : ""}`,
      itemCount: quizSessionEntries.length,
      status,
      entryIds: quizSessionEntries.map(e => e.id),
    });
  }

  return tasks;
}

/**
 * Determine phase for the week
 */
function determinePhase(
  learnTasks: WeeklyPlanTask[],
  reviewTasks: WeeklyPlanTask[],
  practiceTasks: WeeklyPlanTask[]
): "LEARN" | "REVIEW" | "PRACTICE" | "MIXED" {
  const hasLearn = learnTasks.length > 0;
  const hasReview = reviewTasks.length > 0;
  const hasPractice = practiceTasks.length > 0;

  const phaseCount = [hasLearn, hasReview, hasPractice].filter(Boolean).length;

  if (phaseCount > 1) {
    return "MIXED";
  }

  if (hasLearn) return "LEARN";
  if (hasReview) return "REVIEW";
  if (hasPractice) return "PRACTICE";

  return "MIXED"; // Default
}

/**
 * Get week number from date
 * Week 1 starts on planCreatedAt date and ends on the next Sunday
 * Returns at least 1 (no week 0)
 */
function getWeekNumber(date: Date, week1StartDate: Date): number {
  const dateTime = new Date(date).getTime();
  const week1Time = new Date(week1StartDate).getTime();
  const diffDays = Math.floor((dateTime - week1Time) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return Math.max(1, weekNumber); // Ensure at least week 1, no week 0
}

/**
 * Get week start date
 * Week 1 starts on planCreatedAt date
 * Week 2+ starts on the Monday after the previous week's Sunday
 */
function getWeekStart(week1StartDate: Date, weekNumber: number): Date {
  if (weekNumber === 1) {
    // Week 1 starts on plan generation day
    return new Date(week1StartDate);
  }

  // For week 2+, calculate from week 1 end (Sunday)
  const week1End = getWeekEnd(week1StartDate, 1);
  const weekStart = new Date(week1End);
  weekStart.setDate(weekStart.getDate() + 1); // Monday after week 1 Sunday
  weekStart.setDate(weekStart.getDate() + (weekNumber - 2) * 7); // Add weeks
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get week end date
 * Week 1 ends on the next Sunday after plan generation day
 * Week 2+ ends on Sunday (standard week)
 */
function getWeekEnd(week1StartDate: Date, weekNumber: number): Date {
  if (weekNumber === 1) {
    // Week 1 ends on the next Sunday after plan generation day
    const week1Start = new Date(week1StartDate);
    const dayOfWeek = week1Start.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Days to next Sunday
    const week1End = new Date(week1Start);
    week1End.setDate(week1Start.getDate() + daysToSunday);
    week1End.setHours(23, 59, 59, 999);
    return week1End;
  }

  // For week 2+, end on Sunday (standard week)
  const weekStart = getWeekStart(week1StartDate, weekNumber);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}
