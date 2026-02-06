"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import { NoteType } from "@prisma/client";

const moduleSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  title: z.string().min(1, "Title is required"),
  shortTitle: z.string().optional().nullable(), // Short title for sidebar display
  description: z.string().optional(),
  order: z.number().int().nonnegative(),
  examWeight: z.number().min(0).max(1).optional().nullable(), // 0 to 1 (e.g., 0.15 for 15%)
  pdfUrl: z.string().optional().nullable(), // URL for the module PDF
});

export type ModuleActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a new module (admin only)
 */
export async function createModuleAction(
  data: z.infer<typeof moduleSchema>
): Promise<ModuleActionResult> {
  try {
    await requireAdmin();

    const validatedData = moduleSchema.parse(data);

    // Check if order already exists for this course
    const existingModule = await prisma.module.findUnique({
      where: {
        courseId_order: {
          courseId: validatedData.courseId,
          order: validatedData.order,
        },
      },
    });

    if (existingModule) {
      // Shift existing modules
      await prisma.module.updateMany({
        where: {
          courseId: validatedData.courseId,
          order: { gte: validatedData.order },
        },
        data: {
          order: { increment: 1 },
        },
      });
    }

    const moduleRecord = await prisma.module.create({
      data: validatedData,
      include: {
        course: true,
        contentItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    return { success: true, data: moduleRecord };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create module: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating module",
    };
  }
}

/**
 * Update a module (admin only)
 */
export async function updateModuleAction(
  moduleId: string,
  data: Partial<z.infer<typeof moduleSchema>>
): Promise<ModuleActionResult> {
  try {
    await requireAdmin();

    const validatedData = moduleSchema.partial().parse(data);

    // If order is being changed, handle reordering
    if (validatedData.order !== undefined) {
      const moduleRecord = await prisma.module.findUnique({
        where: { id: moduleId },
      });

      if (moduleRecord) {
        const oldOrder = moduleRecord.order;
        const newOrder = validatedData.order;

        if (oldOrder !== newOrder) {
          // Shift modules between old and new positions
          if (newOrder > oldOrder) {
            await prisma.module.updateMany({
              where: {
                courseId: moduleRecord.courseId,
                order: { gt: oldOrder, lte: newOrder },
              },
              data: {
                order: { decrement: 1 },
              },
            });
          } else {
            await prisma.module.updateMany({
              where: {
                courseId: moduleRecord.courseId,
                order: { gte: newOrder, lt: oldOrder },
              },
              data: {
                order: { increment: 1 },
              },
            });
          }
        }
      }
    }

    const updatedModule = await prisma.module.update({
      where: { id: moduleId },
      data: validatedData,
      include: {
        course: true,
        contentItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    return { success: true, data: updatedModule };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update module: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error updating module",
    };
  }
}

/**
 * Delete a module (admin only)
 */
export async function deleteModuleAction(
  moduleId: string
): Promise<ModuleActionResult> {
  try {
    await requireAdmin();

    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (moduleRecord) {
      // Shift remaining modules
      await prisma.module.updateMany({
        where: {
          courseId: moduleRecord.courseId,
          order: { gt: moduleRecord.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    }

    await prisma.module.delete({
      where: { id: moduleId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete module: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting module",
    };
  }
}

/**
 * Reorder modules (admin only)
 */
export async function reorderModulesAction(
  courseId: string,
  moduleOrders: { id: string; order: number }[]
): Promise<ModuleActionResult> {
  try {
    await requireAdmin();

    // Update all modules in a transaction
    const updates = moduleOrders.map(({ id, order }) =>
      prisma.module.update({
        where: { id },
        data: { order },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder modules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while reordering the modules",
    };
  }
}

/**
 * Get modules for a course
 */
export async function getModulesAction(courseId: string) {
  try {
    await requireAdmin();

    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      include: {
        contentItems: {
          orderBy: { order: "asc" },
          include: {
            video: true,
            quiz: {
              include: {
                questions: {
                  orderBy: { order: "asc" },
                },
              },
            },
            notes: {
              where: { type: NoteType.ADMIN },
            },
          },
        },
      },
    });

    return modules;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get modules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}

// Cached function to get course modules
const getCachedCourseModules = unstable_cache(
  async (courseId: string) => {
    return await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        shortTitle: true,
        order: true,
        examWeight: true,
        pdfUrl: true,
      },
    });
  },
  ["course-modules"],
  { revalidate: 600, tags: ["course-modules"] } // 10 minutes
);

/**
 * Get modules for a course (for students - simplified, cached)
 */
export async function getCourseModulesAction(courseId: string) {
  try {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    await requireAuth(); // Students can access modules for courses they're enrolled in

    return await getCachedCourseModules(courseId);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course modules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}

