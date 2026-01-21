"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

export type ModuleContentResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all content items for a module (Phase 1: videos, notes, quizzes)
 * Cached for 5 minutes to improve performance
 */
const getCachedModuleContent = unstable_cache(
  async (moduleId: string) => {
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        contentItems: {
          where: {
            OR: [
              { studyPhase: "PHASE_1_LEARN" },
              { studyPhase: null },
            ],
          },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            contentType: true,
            video: {
              select: {
                id: true,
                vimeoUrl: true,
                duration: true,
                transcript: true,
              },
            },
            quiz: {
              select: {
                id: true,
                title: true,
                passingScore: true,
                timeLimit: true,
                isMockExam: true,
                questions: {
                  orderBy: { order: "asc" },
                  select: {
                    id: true,
                    order: true,
                    question: true,
                    options: true,
                    correctAnswer: true,
                    type: true,
                  },
                },
              },
            },
            notes: {
              where: {
                type: "ADMIN",
              },
              take: 1,
              select: {
                id: true,
                content: true,
              },
            },
          },
        },
      },
    });

    if (!module) {
      return null;
    }

    // Separate content by type
    const videos = module.contentItems
      .filter((item) => item.contentType === "VIDEO" && item.video)
      .map((item) => ({
        id: item.id,
        order: item.order,
        video: item.video,
      }));

    const notes = module.contentItems
      .filter((item) => item.contentType === "NOTE" && item.notes.length > 0)
      .map((item) => ({
        id: item.id,
        order: item.order,
        note: item.notes[0],
      }));

    const quizzes = module.contentItems
      .filter((item) => item.contentType === "QUIZ" && item.quiz && !item.quiz.isMockExam)
      .map((item) => ({
        id: item.id,
        order: item.order,
        quiz: item.quiz,
      }));

    return {
      module: {
        id: module.id,
        title: module.title,
        description: module.description,
        order: module.order,
      },
      videos,
      notes,
      quizzes,
    };
  },
  ["module-content"],
  { 
    revalidate: 300, // 5 minutes
    tags: ["module-content"]
  }
);

export async function getModuleContentAction(moduleId: string): Promise<ModuleContentResult> {
  try {
    const user = await requireAuth();

    // Get cached module content (cache is per module, not per user)
    const cachedData = await getCachedModuleContent(moduleId);

    if (!cachedData) {
      return {
        success: false,
        error: "Module introuvable",
      };
    }

    // Get the module to find the course and check componentVisibility
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        course: {
          select: {
            id: true,
            componentVisibility: true,
          },
        },
      },
    });

    // Get component visibility settings (default to enabled if not set)
    const componentVisibility = (module?.course?.componentVisibility as any) || {};
    const videosEnabled = componentVisibility.videos !== false; // Default to true if not set

    // Filter videos based on componentVisibility
    const filteredData = {
      ...cachedData,
      videos: videosEnabled ? cachedData.videos : [],
    };

    // Get user's progress for this module (not cached, user-specific)
    const moduleProgress = await prisma.moduleProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: user.id,
          moduleId: moduleId,
        },
      },
    });

    return {
      success: true,
      data: {
        ...filteredData,
        progress: moduleProgress,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get module content: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading module content",
    };
  }
}

/**
 * Batch load content for multiple modules (optimized for syllabus and tools)
 * Returns a map of moduleId -> { videos, notes, quizzes }
 * For syllabus: only returns counts (id, order)
 * For tools: can return full data if includeFullData is true
 */
export async function getBatchModuleContentAction(
  moduleIds: string[],
  includeFullData: boolean = false
): Promise<ModuleContentResult> {
  try {
    const user = await requireAuth();

    if (moduleIds.length === 0) {
      return { success: true, data: {} };
    }

    // Single query to get all modules and their content
    const modules = await prisma.module.findMany({
      where: {
        id: { in: moduleIds },
      },
      select: {
        id: true,
        title: true,
        order: true,
        contentItems: {
          where: {
            OR: [
              { studyPhase: "PHASE_1_LEARN" },
              { studyPhase: null },
            ],
          },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            contentType: true,
            video: {
              select: includeFullData
                ? {
                    id: true,
                    vimeoUrl: true,
                    duration: true,
                    transcript: true,
                  }
                : {
                    id: true,
                    vimeoUrl: true,
                    duration: true,
                  },
            },
            quiz: {
              select: {
                id: true,
                title: true,
                isMockExam: true,
              },
            },
            notes: {
              where: {
                type: "ADMIN",
              },
              take: 1,
              select: includeFullData
                ? {
                    id: true,
                    content: true,
                  }
                : {
                    id: true,
                  },
            },
          },
        },
      },
    });

    // Transform data into the expected format
    const result: Record<string, any> = {};

    for (const module of modules) {
      const videos = module.contentItems
        .filter((item) => item.contentType === "VIDEO" && item.video)
        .map((item) => ({
          id: item.id,
          order: item.order,
          ...(includeFullData && item.video ? { video: item.video } : {}),
        }));

      const notes = module.contentItems
        .filter((item) => item.contentType === "NOTE" && item.notes.length > 0)
        .map((item) => ({
          id: item.id,
          order: item.order,
          ...(includeFullData && item.notes[0] ? { note: item.notes[0] } : {}),
        }));

      const quizzes = module.contentItems
        .filter((item) => item.contentType === "QUIZ" && item.quiz && !item.quiz.isMockExam)
        .map((item) => ({
          id: item.id,
          order: item.order,
        }));

      result[module.id] = { videos, notes, quizzes };
    }

    // Ensure all requested moduleIds are in the result (even if empty)
    for (const moduleId of moduleIds) {
      if (!result[moduleId]) {
        result[moduleId] = { videos: [], notes: [], quizzes: [] };
      }
    }

    return { success: true, data: result };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to batch get module content: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading modules content",
    };
  }
}

