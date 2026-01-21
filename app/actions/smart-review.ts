"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { ReviewDifficulty, SmartReviewType, LearnStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

export interface SmartReviewItemWithRelations {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string;
  itemType: SmartReviewType;
  flashcardId: string | null;
  learningActivityId: string | null;
  timesServed: number;
  lastDifficulty: ReviewDifficulty | null;
  probabilityWeight: number;
  lastServedAt: Date | null;
  flashcard?: {
    id: string;
    front: string;
    back: string;
  } | null;
  learningActivity?: {
    id: string;
    title: string;
    activityType: string;
    instructions: string | null;
    content: any;
  } | null;
  module?: {
    id: string;
    title: string;
    order: number;
  } | null;
}

export interface ChapterStats {
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  flashcardsReviewed: number;
  activitiesReviewed: number;
  totalFlashcards: number;
  totalActivities: number;
}

export interface SmartReviewStats {
  totalItemsReviewed: number;
  chapterStats: ChapterStats[];
  completedChapters: string[]; // Module IDs that are marked as LEARNED
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get completed (LEARNED) module IDs for a user's course
 * Chapter 1 (order = 1) is always included
 */
async function getCompletedModuleIds(
  userId: string,
  courseId: string
): Promise<string[]> {
  // Get all modules for the course
  const modules = await prisma.module.findMany({
    where: { courseId },
    select: { id: true, order: true },
    orderBy: { order: "asc" },
  });

  if (modules.length === 0) return [];

  // Get module progress for this user
  const progress = await prisma.moduleProgress.findMany({
    where: {
      userId,
      courseId,
      learnStatus: LearnStatus.LEARNED,
    },
    select: { moduleId: true },
  });

  const learnedModuleIds = new Set(progress.map((p) => p.moduleId));

  // Chapter 1 (first module by order) is always unlocked
  const firstModule = modules.find((m) => m.order === 1) || modules[0];
  learnedModuleIds.add(firstModule.id);

  return Array.from(learnedModuleIds);
}

/**
 * Weighted random selection based on probability weights
 * Items with lower weights (marked EASY) are less likely to be selected
 */
function weightedRandomSelect<T extends { probabilityWeight: number }>(
  items: T[]
): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + item.probabilityWeight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.probabilityWeight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

// ============================================
// Server Actions
// ============================================

/**
 * Get smart review statistics for a course
 */
export async function getSmartReviewStatsAction(
  courseId: string
): Promise<{ success: boolean; data?: SmartReviewStats; error?: string }> {
  try {
    const user = await requireAuth();

    // Get completed module IDs
    const completedModuleIds = await getCompletedModuleIds(user.id, courseId);

    // Get all modules for the course
    const modules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true, title: true, order: true },
      orderBy: { order: "asc" },
    });

    // Get review progress
    const progress = await prisma.smartReviewProgress.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    // Get reviewed items grouped by module
    const reviewedItems = await prisma.smartReviewItem.findMany({
      where: {
        userId: user.id,
        courseId,
        timesServed: { gt: 0 },
      },
      select: {
        moduleId: true,
        itemType: true,
      },
    });

    // Get total flashcards and activities per completed module
    const flashcardCounts = await prisma.flashcard.groupBy({
      by: ["moduleId"],
      where: {
        courseId,
        moduleId: { in: completedModuleIds },
      },
      _count: true,
    });

    const activityCounts = await prisma.learningActivity.groupBy({
      by: ["moduleId"],
      where: {
        courseId,
        moduleId: { in: completedModuleIds },
      },
      _count: true,
    });

    // Build chapter stats
    const chapterStats: ChapterStats[] = modules
      .filter((m) => completedModuleIds.includes(m.id))
      .map((module) => {
        const moduleReviewed = reviewedItems.filter((r) => r.moduleId === module.id);
        const flashcardCount = flashcardCounts.find((f) => f.moduleId === module.id)?._count || 0;
        const activityCount = activityCounts.find((a) => a.moduleId === module.id)?._count || 0;

        return {
          moduleId: module.id,
          moduleTitle: module.title,
          moduleOrder: module.order,
          flashcardsReviewed: moduleReviewed.filter((r) => r.itemType === "FLASHCARD").length,
          activitiesReviewed: moduleReviewed.filter((r) => r.itemType === "ACTIVITY").length,
          totalFlashcards: flashcardCount,
          totalActivities: activityCount,
        };
      });

    return {
      success: true,
      data: {
        totalItemsReviewed: progress?.totalItemsReviewed || 0,
        chapterStats,
        completedChapters: completedModuleIds,
      },
    };
  } catch (error) {
    console.error("Error fetching smart review stats:", error);
    return { success: false, error: "Error retrieving statistics" };
  }
}

/**
 * Get the next item to review
 * Prioritizes unseen items, then uses weighted random selection
 */
export async function getNextReviewItemAction(
  courseId: string
): Promise<{ success: boolean; data?: SmartReviewItemWithRelations; error?: string }> {
  try {
    const user = await requireAuth();

    // Get completed module IDs
    const completedModuleIds = await getCompletedModuleIds(user.id, courseId);

    if (completedModuleIds.length === 0) {
      return { success: false, error: "No chapters available for review" };
    }

    // Get all flashcards from completed modules
    const flashcards = await prisma.flashcard.findMany({
      where: {
        courseId,
        moduleId: { in: completedModuleIds },
      },
      select: { id: true, moduleId: true, front: true, back: true },
    });

    // Get all activities from completed modules
    const activities = await prisma.learningActivity.findMany({
      where: {
        courseId,
        moduleId: { in: completedModuleIds },
      },
      include: {
        contentItem: {
          include: {
            module: true,
          },
        },
      },
    });

    // Get existing review items for this user
    const existingItems = await prisma.smartReviewItem.findMany({
      where: {
        userId: user.id,
        courseId,
      },
    });

    const existingFlashcardIds = new Set(
      existingItems.filter((i) => i.flashcardId).map((i) => i.flashcardId)
    );
    const existingActivityIds = new Set(
      existingItems.filter((i) => i.learningActivityId).map((i) => i.learningActivityId)
    );

    // Find unseen items (not in SmartReviewItem table yet)
    const unseenFlashcards = flashcards.filter((f) => !existingFlashcardIds.has(f.id));
    const unseenActivities = activities.filter((a) => !existingActivityIds.has(a.id));

    // If there are unseen items, pick one randomly
    if (unseenFlashcards.length > 0 || unseenActivities.length > 0) {
      const allUnseen = [
        ...unseenFlashcards.map((f) => ({ type: "flashcard" as const, item: f })),
        ...unseenActivities.map((a) => ({ type: "activity" as const, item: a })),
      ];

      const selected = allUnseen[Math.floor(Math.random() * allUnseen.length)];

      // Create the review item record
      if (selected.type === "flashcard") {
        const flashcard = selected.item as typeof flashcards[0];
        const newItem = await prisma.smartReviewItem.create({
          data: {
            userId: user.id,
            courseId,
            moduleId: flashcard.moduleId!,
            itemType: SmartReviewType.FLASHCARD,
            flashcardId: flashcard.id,
            timesServed: 1,
            lastServedAt: new Date(),
          },
          include: {
            flashcard: { select: { id: true, front: true, back: true } },
            module: { select: { id: true, title: true, order: true } },
          },
        });

        // Update progress
        await updateReviewProgress(user.id, courseId, newItem.id);

        return { success: true, data: newItem as SmartReviewItemWithRelations };
      } else {
        const activity = selected.item as typeof activities[0];
        const newItem = await prisma.smartReviewItem.create({
          data: {
            userId: user.id,
            courseId,
            moduleId: activity.contentItem?.module?.id || activity.moduleId!,
            itemType: SmartReviewType.ACTIVITY,
            learningActivityId: activity.id,
            timesServed: 1,
            lastServedAt: new Date(),
          },
          include: {
            learningActivity: {
              select: {
                id: true,
                title: true,
                activityType: true,
                instructions: true,
                content: true,
              },
            },
            module: { select: { id: true, title: true, order: true } },
          },
        });

        // Update progress
        await updateReviewProgress(user.id, courseId, newItem.id);

        return { success: true, data: newItem as SmartReviewItemWithRelations };
      }
    }

    // All items have been seen at least once - use weighted random selection
    const seenItems = existingItems.filter((item) => {
      // Only include items from completed modules
      return completedModuleIds.includes(item.moduleId);
    });

    if (seenItems.length === 0) {
      return { success: false, error: "No items available for review" };
    }

    // Weighted random selection
    const selected = weightedRandomSelect(seenItems);

    if (!selected) {
      return { success: false, error: "Error selecting the item" };
    }

    // Update the selected item
    const updatedItem = await prisma.smartReviewItem.update({
      where: { id: selected.id },
      data: {
        timesServed: { increment: 1 },
        lastServedAt: new Date(),
      },
      include: {
        flashcard: { select: { id: true, front: true, back: true } },
        learningActivity: {
          select: {
            id: true,
            title: true,
            activityType: true,
            instructions: true,
            content: true,
          },
        },
        module: { select: { id: true, title: true, order: true } },
      },
    });

    // Update progress
    await updateReviewProgress(user.id, courseId, updatedItem.id);

    return { success: true, data: updatedItem as SmartReviewItemWithRelations };
  } catch (error) {
    console.error("Error getting next review item:", error);
    return { success: false, error: "Error retrieving the item" };
  }
}

/**
 * Rate a review item (Easy/Medium/Hard)
 */
export async function rateReviewItemAction(
  itemId: string,
  difficulty: ReviewDifficulty
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Get the item
    const item = await prisma.smartReviewItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.userId !== user.id) {
      return { success: false, error: "Item introuvable" };
    }

    // Calculate new probability weight based on difficulty
    let newWeight = 1.0;
    switch (difficulty) {
      case "EASY":
        newWeight = 0.5; // 50% less likely to appear
        break;
      case "MEDIUM":
        newWeight = 1.0; // No change
        break;
      case "HARD":
        newWeight = 1.3; // 30% more likely to appear
        break;
    }

    // Update the item
    await prisma.smartReviewItem.update({
      where: { id: itemId },
      data: {
        lastDifficulty: difficulty,
        probabilityWeight: newWeight,
      },
    });

    revalidatePath(`/learn/${item.courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Error rating review item:", error);
    return { success: false, error: "Error saving" };
  }
}

/**
 * Update review progress (track position and total items)
 */
async function updateReviewProgress(
  userId: string,
  courseId: string,
  lastItemId: string
): Promise<void> {
  await prisma.smartReviewProgress.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    update: {
      lastItemId,
      totalItemsReviewed: { increment: 1 },
    },
    create: {
      userId,
      courseId,
      lastItemId,
      totalItemsReviewed: 1,
    },
  });
}

/**
 * Get review progress for resuming
 */
export async function getReviewProgressAction(
  courseId: string
): Promise<{ success: boolean; data?: { totalItemsReviewed: number; lastItemId: string | null }; error?: string }> {
  try {
    const user = await requireAuth();

    const progress = await prisma.smartReviewProgress.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    return {
      success: true,
      data: {
        totalItemsReviewed: progress?.totalItemsReviewed || 0,
        lastItemId: progress?.lastItemId || null,
      },
    };
  } catch (error) {
    console.error("Error getting review progress:", error);
    return { success: false, error: "Error retrieving progress" };
  }
}
