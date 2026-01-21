"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import { NoteType } from "@prisma/client";

const contentItemSchema = z.object({
  moduleId: z.string().min(1, "L'ID du module est requis"),
  contentType: z.enum(["VIDEO", "QUIZ", "FLASHCARD", "NOTE", "LEARNING_ACTIVITY"]),
  order: z.number().int().nonnegative(),
  studyPhase: z.enum(["PHASE_1_LEARN", "PHASE_2_REVIEW", "PHASE_3_PRACTICE"]).optional().nullable(),
});

const videoSchema = z.object({
  vimeoUrl: z.string().url("L'URL Vimeo est invalide"),
  duration: z.number().int().positive().optional(),
  transcript: z.string().optional(),
});

const quizSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  passingScore: z.number().int().min(0).max(100).default(70),
  timeLimit: z.number().int().positive().optional(),
});

const noteSchema = z.object({
  content: z.string().min(1, "Le contenu est requis"),
});

const quizQuestionSchema = z.object({
  quizId: z.string(),
  type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "TRUE_FALSE"]),
  question: z.string().min(1, "La question est requise"),
  // JSON field: represent "no options" as undefined (not null) for Prisma compatibility
  options: z.record(z.string(), z.string()).optional(),
  correctAnswer: z.string().min(1, "The correct answer is required"),
  order: z.number().int().nonnegative(),
});

export type ContentItemActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get the next available order for a module
 */
async function getNextOrderForModule(moduleId: string): Promise<number> {
  const maxOrderItem = await prisma.contentItem.findFirst({
    where: { moduleId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  
  return maxOrderItem ? maxOrderItem.order + 1 : 0;
}

/**
 * Create a content item (admin only)
 */
export async function createContentItemAction(
  data: z.infer<typeof contentItemSchema> & {
    video?: z.infer<typeof videoSchema>;
    quiz?: z.infer<typeof quizSchema>;
    note?: z.infer<typeof noteSchema>;
  }
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const { video, quiz, note, ...contentItemInput } = data;
    const validatedContentItem = contentItemSchema.parse(contentItemInput);

    if (validatedContentItem.contentType === "NOTE" && !note) {
      return {
        success: false,
        error: "Le contenu de la note est requis",
      };
    }

    // If order is 0 or not specified, find the next available order
    let finalOrder = validatedContentItem.order;
    if (finalOrder === 0) {
      // Check if order 0 already exists - if so, use next available
      const existingItem = await prisma.contentItem.findUnique({
        where: {
          moduleId_order: {
            moduleId: validatedContentItem.moduleId,
            order: 0,
          },
        },
      });
      
      if (existingItem) {
        finalOrder = await getNextOrderForModule(validatedContentItem.moduleId);
      }
    } else {
      // Check if the specified order already exists
      const existingItem = await prisma.contentItem.findUnique({
        where: {
          moduleId_order: {
            moduleId: validatedContentItem.moduleId,
            order: validatedContentItem.order,
          },
        },
      });

      if (existingItem) {
        // Shift existing items - need to do this carefully to avoid unique constraint violations
        // Get all items that need to be shifted, ordered by order descending
        const itemsToShift = await prisma.contentItem.findMany({
          where: {
            moduleId: validatedContentItem.moduleId,
            order: { gte: validatedContentItem.order },
          },
          orderBy: {
            order: 'desc',
          },
        });

        // Find a safe temporary offset (much higher than any existing order)
        const maxOrder = await prisma.contentItem.findFirst({
          where: {
            moduleId: validatedContentItem.moduleId,
          },
          orderBy: {
            order: 'desc',
          },
          select: {
            order: true,
          },
        });

        const tempOffset = (maxOrder?.order || 0) + 10000;

        // Step 1: Move items to temporary positions (in reverse order to avoid conflicts)
        for (let i = 0; i < itemsToShift.length; i++) {
          await prisma.contentItem.update({
            where: {
              id: itemsToShift[i].id,
            },
            data: {
              order: tempOffset + i,
            },
          });
        }

        // Step 2: Move items back to their final positions (in reverse order)
        // Final position for item at index i: validatedContentItem.order + itemsToShift.length - i
        for (let i = 0; i < itemsToShift.length; i++) {
          await prisma.contentItem.update({
            where: {
              id: itemsToShift[i].id,
            },
            data: {
              order: validatedContentItem.order + itemsToShift.length - i,
            },
          });
        }
      }
    }

    // Prepare data, handling optional studyPhase
    const contentItemData: any = {
      moduleId: validatedContentItem.moduleId,
      order: finalOrder,
      contentType: validatedContentItem.contentType,
    };
    
    // Only include studyPhase if it's provided (migration might not be run yet)
    if (validatedContentItem.studyPhase !== undefined && validatedContentItem.studyPhase !== null) {
      contentItemData.studyPhase = validatedContentItem.studyPhase;
    }

    // Build the data object
    const createData: any = {
      ...contentItemData,
    };

    // Get courseId from module for nested creates (Quiz, Note)
    let courseIdForNested: string | undefined;
    if (validatedContentItem.contentType === "QUIZ" || validatedContentItem.contentType === "NOTE") {
      const module = await prisma.module.findUnique({
        where: { id: validatedContentItem.moduleId },
        select: { courseId: true },
      });
      if (!module) {
        return {
          success: false,
          error: "Module introuvable",
        };
      }
      courseIdForNested = module.courseId;
    }

    // Add nested relations only for specific content types
    if (validatedContentItem.contentType === "VIDEO" && video) {
      createData.video = {
        create: videoSchema.parse(video),
      };
    } else if (validatedContentItem.contentType === "QUIZ" && quiz) {
      createData.quiz = {
        create: {
          ...quizSchema.parse(quiz),
          courseId: courseIdForNested!, // Direct course link for efficient queries
        },
      };
    } else if (validatedContentItem.contentType === "NOTE" && note) {
      createData.notes = {
        create: {
          type: NoteType.ADMIN,
          content: noteSchema.parse(note).content,
          courseId: courseIdForNested, // Direct course link for efficient queries (nullable)
        },
      };
    }
    // LEARNING_ACTIVITY doesn't need nested creation here - it's created separately

    console.log("Creating ContentItem with data:", JSON.stringify(createData, null, 2));

    const contentItem = await prisma.contentItem.create({
      data: createData,
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
        learningActivity: true,
      },
    });

    return { success: true, data: contentItem };
  } catch (error) {
    console.error("createContentItemAction error:", error);
    
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      console.error("Validation errors:", errorDetails);
      return {
        success: false,
        error: `Données invalides: ${errorDetails}`,
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check for common Prisma errors
    if (errorMessage.includes("Unknown arg") || errorMessage.includes("does not exist") || errorMessage.includes("Unknown field")) {
      return {
        success: false,
        error: `Erreur de base de données: ${errorMessage}. Assurez-vous d'avoir exécuté la migration: npx prisma migrate dev`,
      };
    }

    await logServerError({
      errorMessage: `Failed to create content item: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de la création de l'élément de contenu: ${errorMessage}`,
    };
  }
}

/**
 * Update a content item (admin only)
 */
export async function updateContentItemAction(
  contentItemId: string,
  data: Partial<z.infer<typeof contentItemSchema>> & {
    video?: Partial<z.infer<typeof videoSchema>>;
    quiz?: Partial<z.infer<typeof quizSchema>>;
    note?: Partial<z.infer<typeof noteSchema>>;
  }
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const { video, quiz, note, ...contentItemInput } = data;
    const validatedContentItem = contentItemSchema.partial().parse(contentItemInput);

    // Handle order changes
    if (validatedContentItem.order !== undefined) {
      const item = await prisma.contentItem.findUnique({
        where: { id: contentItemId },
      });

      if (item) {
        const oldOrder = item.order;
        const newOrder = validatedContentItem.order;

        if (oldOrder !== newOrder) {
          if (newOrder > oldOrder) {
            await prisma.contentItem.updateMany({
              where: {
                moduleId: item.moduleId,
                order: { gt: oldOrder, lte: newOrder },
              },
              data: {
                order: { decrement: 1 },
              },
            });
          } else {
            await prisma.contentItem.updateMany({
              where: {
                moduleId: item.moduleId,
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

    const updateData: any = { ...validatedContentItem };

    if (video) {
      updateData.video = {
        update: videoSchema.partial().parse(video),
      };
    }

    if (quiz) {
      updateData.quiz = {
        update: quizSchema.partial().parse(quiz),
      };
    }

    if (note) {
      const parsedNote = noteSchema.partial().parse(note);
      if (parsedNote.content) {
        // For admin notes with userId: null, handle upsert separately
        // because Prisma's unique constraint with nullable fields requires special handling
        const existingAdminNote = await prisma.note.findFirst({
          where: {
            contentItemId,
            type: NoteType.ADMIN,
            userId: null,
          },
        });

        if (existingAdminNote) {
          // Update existing note directly
          await prisma.note.update({
            where: {
              id: existingAdminNote.id,
            },
            data: {
              content: parsedNote.content,
            },
          });
        } else {
          // Create new note directly
          await prisma.note.create({
            data: {
              contentItemId,
              type: NoteType.ADMIN,
              content: parsedNote.content,
              userId: null,
            },
          });
        }
        // Don't include notes in updateData since we handled it separately
      }
    }

    const updatedItem = await prisma.contentItem.update({
      where: { id: contentItemId },
      data: updateData,
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
    });

    return { success: true, data: updatedItem };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update content item: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating the content item",
    };
  }
}

/**
 * Delete a content item (admin only)
 */
export async function deleteContentItemAction(
  contentItemId: string
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const item = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
    });

    if (!item) {
      return {
        success: false,
        error: "Content item not found",
      };
    }

    // Delete the item first
    await prisma.contentItem.delete({
      where: { id: contentItemId },
    });

    // Then reorder remaining items sequentially to avoid unique constraint violations
    const remainingItems = await prisma.contentItem.findMany({
      where: {
        moduleId: item.moduleId,
      },
      orderBy: { order: "asc" },
    });

    // Update orders sequentially to ensure no conflicts
    for (let i = 0; i < remainingItems.length; i++) {
      if (remainingItems[i].order !== i) {
        await prisma.contentItem.update({
          where: { id: remainingItems[i].id },
          data: { order: i },
        });
      }
    }

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete content item: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de la suppression: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Create a quiz question (admin only)
 */
export async function createQuizQuestionAction(
  data: z.infer<typeof quizQuestionSchema>
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    // Clean up the data - remove null/undefined/empty options
    const cleanedData = { ...data };
    const opts = cleanedData.options;
    if (opts == null || (typeof opts === "object" && !Array.isArray(opts) && Object.keys(opts).length === 0)) {
      delete cleanedData.options;
    }

    const validatedData = quizQuestionSchema.parse(cleanedData);

    // Check if order exists
    const existingQuestion = await prisma.quizQuestion.findUnique({
      where: {
        quizId_order: {
          quizId: validatedData.quizId,
          order: validatedData.order,
        },
      },
    });

    if (existingQuestion) {
      await prisma.quizQuestion.updateMany({
        where: {
          quizId: validatedData.quizId,
          order: { gte: validatedData.order },
        },
        data: {
          order: { increment: 1 },
        },
      });
    }

    const question = await prisma.quizQuestion.create({
      data: validatedData,
    });

    return { success: true, data: question };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return {
        success: false,
        error: errorMessage || "Invalid data",
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logServerError({
      errorMessage: `Failed to create quiz question: ${errorMessage}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de la création de la question: ${errorMessage}`,
    };
  }
}

/**
 * Update a quiz question (admin only)
 */
export async function updateQuizQuestionAction(
  questionId: string,
  data: Partial<z.infer<typeof quizQuestionSchema>>
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    // Clean up options for Prisma JSON compatibility (avoid null)
    const cleanedData: typeof data = { ...data };
    if (cleanedData.options == null) delete cleanedData.options;
    const validatedData = quizQuestionSchema.partial().parse(cleanedData);

    const question = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: validatedData,
    });

    return { success: true, data: question };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update quiz question: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating the question",
    };
  }
}

/**
 * Delete a quiz question (admin only)
 */
export async function deleteQuizQuestionAction(
  questionId: string
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (question) {
      await prisma.quizQuestion.delete({
        where: { id: questionId },
      });

      await prisma.quizQuestion.updateMany({
        where: {
          quizId: question.quizId,
          order: { gt: question.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    }

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete quiz question: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while deleting the question",
    };
  }
}

/**
 * Reorder quiz questions (admin only)
 */
export async function reorderQuizQuestionsAction(
  quizId: string,
  questionOrders: { id: string; order: number }[]
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const updates = questionOrders.map(({ id, order }) =>
      prisma.quizQuestion.update({
        where: { id },
        data: { order },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder quiz questions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while reordering the questions",
    };
  }
}

/**
 * Reorder content items (admin only)
 */
export async function reorderContentItemsAction(
  moduleId: string,
  itemOrders: { id: string; order: number }[]
): Promise<ContentItemActionResult> {
  try {
    await requireAdmin();

    const updates = itemOrders.map(({ id, order }) =>
      prisma.contentItem.update({
        where: { id },
        data: { order },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder content items: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while reordering the items",
    };
  }
}

