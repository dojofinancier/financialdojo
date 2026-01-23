"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

const flashcardSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  moduleId: z.string().optional().nullable(),
  front: z.string().min(1, "Front is required"),
  back: z.string().min(1, "Back is required"),
});

export type FlashcardActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function getFlashcardsAction(courseId: string, moduleId?: string | null) {
  try {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    await requireAuth(); // Students can access flashcards for courses they're enrolled in

    const where: any = { courseId };
    if (moduleId) {
      where.moduleId = moduleId;
    }

    // Build include conditionally - module relation is optional
    // Note: After regenerating Prisma Client, we can include the module relation
    const flashcards = await prisma.flashcard.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: flashcards };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("getFlashcardsAction error:", errorMessage, errorStack);
    
    await logServerError({
      errorMessage: `Failed to get flashcards: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "MEDIUM",
    });

    return { 
      success: false, 
      error: `Error loading flashcards: ${errorMessage}`,
      data: [] 
    };
  }
}

const studySessionSchema = z.object({
  flashcardId: z.string().min(1),
  difficulty: z.enum(["EASY", "DIFFICULT"]),
});

export async function createFlashcardStudySessionAction(
  data: z.infer<typeof studySessionSchema>
): Promise<FlashcardActionResult> {
  try {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    const user = await requireAuth();

    const validatedData = studySessionSchema.parse(data);

    const session = await prisma.flashcardStudySession.create({
      data: {
        userId: user.id,
        flashcardId: validatedData.flashcardId,
        difficulty: validatedData.difficulty,
      },
    });

    return { success: true, data: session };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create flashcard study session: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error saving the session",
    };
  }
}

export async function createFlashcardAction(data: z.infer<typeof flashcardSchema>): Promise<FlashcardActionResult> {
  try {
    await requireAdmin();

    const validatedData = flashcardSchema.parse(data);

    const flashcard = await prisma.flashcard.create({
      data: validatedData,
    });

    return { success: true, data: flashcard };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create flashcard: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating the flashcard",
    };
  }
}

export async function updateFlashcardAction(
  flashcardId: string,
  data: Partial<Omit<z.infer<typeof flashcardSchema>, "courseId">>
): Promise<FlashcardActionResult> {
  try {
    await requireAdmin();

    // Create a schema for update that allows partial fields
    const updateSchema = z.object({
      front: z.string().min(1).optional(),
      back: z.string().min(1).optional(),
      moduleId: z.string().nullable().optional(),
    });

    const validatedData = updateSchema.parse(data);

    // Handle null moduleId explicitly - convert empty string or undefined to null
    const updateData: any = {};
    if (validatedData.front !== undefined) updateData.front = validatedData.front;
    if (validatedData.back !== undefined) updateData.back = validatedData.back;
    if (validatedData.moduleId !== undefined) {
      updateData.moduleId = validatedData.moduleId === null || validatedData.moduleId === "" ? null : validatedData.moduleId;
    }

    const flashcard = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: updateData,
    });

    return { success: true, data: flashcard };
  } catch (error) {
    console.error("Update flashcard error:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update flashcard: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error updating the flashcard: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function deleteFlashcardAction(flashcardId: string): Promise<FlashcardActionResult> {
  try {
    await requireAdmin();

    await prisma.flashcard.delete({
      where: { id: flashcardId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete flashcard: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the flashcard",
    };
  }
}
