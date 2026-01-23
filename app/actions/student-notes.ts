"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";

export type StudentNoteActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get student note for a module
 */
export async function getStudentModuleNoteAction(
  moduleId: string
): Promise<StudentNoteActionResult> {
  try {
    const user = await requireAuth();

    // Find the note by module (we'll store it on the first content item or create a virtual one)
    // Actually, let's store it on the module itself by finding any content item in the module
    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        courseId: true,
        contentItems: {
          take: 1,
          orderBy: { order: "asc" },
        },
      },
    });

    if (!moduleRecord) {
      return {
        success: false,
        error: "Module not found",
      };
    }

    // Use the first content item as the anchor, or create a note without contentItemId
    // Actually, let's use a different approach - store notes per module using a special pattern
    // For now, we'll use the first content item as anchor
    // Use the first content item as anchor for module-level notes
    // If no content items exist, we can't store the note (would need a different approach)
    const anchorContentItemId = moduleRecord.contentItems[0]?.id;

    if (!anchorContentItemId) {
      // No content items in module - return empty note
      // In the future, we could create a special "module_note" content item
      return {
        success: true,
        data: { content: "", exists: false, canSave: false },
      };
    }

    const note = await prisma.note.findUnique({
      where: {
        contentItemId_type_userId: {
          contentItemId: anchorContentItemId,
          type: "STUDENT",
          userId: user.id,
        },
      },
    });

    return {
      success: true,
      data: {
        content: note?.content || "",
        exists: !!note,
        noteId: note?.id,
        canSave: true,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get student module note: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading the note",
    };
  }
}

/**
 * Save student note for a module
 */
export async function saveStudentModuleNoteAction(
  moduleId: string,
  content: string
): Promise<StudentNoteActionResult> {
  try {
    const user = await requireAuth();

    // Get module and find anchor content item
    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        contentItems: {
          take: 1,
          orderBy: { order: "asc" },
        },
      },
    });

    if (!moduleRecord) {
      return {
        success: false,
        error: "Module not found",
      };
    }

    // Use the first content item as anchor for module-level notes
    const anchorContentItemId = moduleRecord.contentItems[0]?.id;

    if (!anchorContentItemId) {
      return {
        success: false,
        error: "No content found in this module. Please contact the administrator.",
      };
    }

    // Upsert the note
    const note = await prisma.note.upsert({
      where: {
        contentItemId_type_userId: {
          contentItemId: anchorContentItemId,
          type: "STUDENT",
          userId: user.id,
        },
      },
      create: {
        contentItemId: anchorContentItemId,
        userId: user.id,
        type: "STUDENT",
        content: content,
      },
      update: {
        content: content,
      },
    });

    revalidatePath(`/learn/${moduleRecord.courseId}`);
    return {
      success: true,
      data: note,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to save student module note: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error saving the note",
    };
  }
}

