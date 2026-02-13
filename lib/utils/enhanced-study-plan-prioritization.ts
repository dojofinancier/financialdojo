/**
 * Prioritization functions for Phase 2 review scheduling
 */

import { prisma } from "@/lib/prisma";
import type { ModuleInventory } from "./course-content-inventory";

/**
 * Prioritize flashcards: Minimum per module + difficult items
 */
export async function prioritizeFlashcards(
  courseId: string,
  userId: string,
  learnedModules: ModuleInventory[],
  moduleFlashcardMap: Map<string, string[]>,
  allFlashcardIds: string[]
): Promise<string[]> {
  const prioritized: string[] = [];
  const MIN_FLASHCARDS_PER_MODULE = 10;

  // First, ensure minimum coverage per module
  for (const moduleRecord of learnedModules) {
    const moduleFlashcards = moduleFlashcardMap.get(moduleRecord.id) || [];
    if (moduleFlashcards.length > 0) {
      // Take minimum per module
      const toTake = Math.min(MIN_FLASHCARDS_PER_MODULE, moduleFlashcards.length);
      prioritized.push(...moduleFlashcards.slice(0, toTake));
    }
  }

  // Then, add difficult flashcards (based on self-rating from smart review)
  // Check SmartReviewItem for difficulty ratings
  const smartReviewItems = await prisma.smartReviewItem.findMany({
    where: {
      userId,
      courseId,
      flashcardId: { in: allFlashcardIds },
      lastDifficulty: "HARD",
    },
    select: {
      flashcardId: true,
    },
  });

  const difficultFlashcardIds = new Set<string>(
    smartReviewItems.map((item) => item.flashcardId).filter((id): id is string => id !== null)
  );

  // Add difficult flashcards that aren't already included
  for (const flashcardId of difficultFlashcardIds) {
    if (!prioritized.includes(flashcardId)) {
      prioritized.push(flashcardId);
    }
  }

  // Fill remaining slots with other flashcards
  const remaining = allFlashcardIds.filter((id) => !prioritized.includes(id));
  prioritized.push(...remaining);

  return prioritized;
}

/**
 * Prioritize activities: Minimum per module + activities from failed quiz modules
 */
export async function prioritizeActivities(
  courseId: string,
  userId: string,
  learnedModules: ModuleInventory[],
  moduleActivityMap: Map<string, string[]>,
  allActivityIds: string[]
): Promise<string[]> {
  const prioritized: string[] = [];
  const MIN_ACTIVITIES_PER_MODULE = 5;

  // Get modules with failed quizzes (score < 70%)
  // Quiz doesn't have courseId - we need to filter through contentItem.module.courseId
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: {
        isMockExam: false, // Phase 1 mini-quizzes only
        contentItem: {
          module: {
            courseId: courseId,
          },
        },
      },
    },
    include: {
      quiz: {
        include: {
          contentItem: {
            select: {
              moduleId: true,
            },
          },
        },
      },
    },
  });

  const failedQuizModuleIds = new Set<string>();
  for (const attempt of quizAttempts) {
    const score = attempt.score;
    const passingScore = attempt.quiz.passingScore || 70;
    if (score < passingScore && attempt.quiz.contentItem?.moduleId) {
      failedQuizModuleIds.add(attempt.quiz.contentItem.moduleId);
    }
  }

  // First, ensure minimum coverage per module
  for (const moduleRecord of learnedModules) {
    const moduleActivities = moduleActivityMap.get(moduleRecord.id) || [];
    if (moduleActivities.length > 0) {
      // Take minimum per module
      const toTake = Math.min(MIN_ACTIVITIES_PER_MODULE, moduleActivities.length);
      prioritized.push(...moduleActivities.slice(0, toTake));
    }
  }

  // Then, prioritize activities from modules with failed quizzes
  for (const moduleRecord of learnedModules) {
    if (failedQuizModuleIds.has(moduleRecord.id)) {
      const moduleActivities = moduleActivityMap.get(moduleRecord.id) || [];
      for (const activityId of moduleActivities) {
        if (!prioritized.includes(activityId)) {
          prioritized.push(activityId);
        }
      }
    }
  }

  // Fill remaining slots with other activities
  const remaining = allActivityIds.filter((id) => !prioritized.includes(id));
  prioritized.push(...remaining);

  return prioritized;
}
