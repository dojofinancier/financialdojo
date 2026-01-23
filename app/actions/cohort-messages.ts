"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminOrInstructor, requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { sendCohortMessageWebhook } from "@/lib/webhooks/make";

const cohortMessageSchema = z.object({
  cohortId: z.string().min(1),
  content: z.string().min(1, "Content is required"),
  attachments: z.array(z.string()).optional().default([]),
});

export type CohortMessageActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a cohort message (enrolled students, admins, instructors)
 */
export async function createCohortMessageAction(
  data: z.infer<typeof cohortMessageSchema>
): Promise<CohortMessageActionResult> {
  try {
    const user = await requireAuth();

    const validatedData = cohortMessageSchema.parse(data);

    // Check if user has access to the cohort
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId: validatedData.cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // Admins and instructors can post without enrollment
    const isAdminOrInstructor = user.role === "ADMIN" || user.role === "INSTRUCTOR";

    if (!enrollment && !isAdminOrInstructor) {
      return {
        success: false,
        error: "You do not have access to this cohort",
      };
    }

    // If instructor, check if it's their cohort
    if (user.role === "INSTRUCTOR") {
      const cohort = await prisma.cohort.findUnique({
        where: { id: validatedData.cohortId },
      });

      if (cohort && cohort.instructorId !== user.id) {
        return {
          success: false,
          error: "You do not have access to this cohort",
        };
      }
    }

    const message = await prisma.cohortMessage.create({
      data: {
        cohortId: validatedData.cohortId,
        authorId: user.id,
        content: validatedData.content,
        attachments: validatedData.attachments || [],
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Send webhook to make.com for notifications (non-blocking)
    sendCohortMessageWebhook({
      messageId: message.id,
      cohortId: message.cohortId,
      cohortTitle: message.cohort.title,
      authorId: message.authorId,
      authorEmail: message.author.email,
      authorName: `${message.author.firstName} ${message.author.lastName}`,
      content: message.content,
      hasAttachments: Array.isArray(message.attachments) && message.attachments.length > 0,
      timestamp: message.createdAt.toISOString(),
    }).catch((error) => {
      console.error("Failed to send cohort message webhook:", error);
    });

    return { success: true, data: message };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create cohort message: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating the message",
    };
  }
}

/**
 * Update a cohort message (author can edit their own, admins/instructors can edit any)
 */
export async function updateCohortMessageAction(
  messageId: string,
  data: Partial<z.infer<typeof cohortMessageSchema>>
): Promise<CohortMessageActionResult> {
  try {
    const user = await requireAuth();

    // Check if message exists
    const existingMessage = await prisma.cohortMessage.findUnique({
      where: { id: messageId },
      include: {
        cohort: true,
      },
    });

    if (!existingMessage) {
      return {
        success: false,
        error: "Message not found",
      };
    }

    // Check permissions
    const isAdmin = user.role === "ADMIN";
    const isInstructor = user.role === "INSTRUCTOR" && existingMessage.cohort.instructorId === user.id;
    const isAuthor = existingMessage.authorId === user.id;

    if (!isAdmin && !isInstructor && !isAuthor) {
      return {
        success: false,
        error: "You do not have permission to modify this message",
      };
    }

    const validatedData = cohortMessageSchema.partial().parse(data);

    const message = await prisma.cohortMessage.update({
      where: { id: messageId },
      data: validatedData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: message };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update cohort message: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error updating the message",
    };
  }
}

/**
 * Delete a cohort message (author can delete their own, admins/instructors can delete any)
 */
export async function deleteCohortMessageAction(
  messageId: string
): Promise<CohortMessageActionResult> {
  try {
    const user = await requireAuth();

    // Check if message exists
    const existingMessage = await prisma.cohortMessage.findUnique({
      where: { id: messageId },
      include: {
        cohort: true,
      },
    });

    if (!existingMessage) {
      return {
        success: false,
        error: "Message not found",
      };
    }

    // Check permissions
    const isAdmin = user.role === "ADMIN";
    const isInstructor = user.role === "INSTRUCTOR" && existingMessage.cohort.instructorId === user.id;
    const isAuthor = existingMessage.authorId === user.id;

    if (!isAdmin && !isInstructor && !isAuthor) {
      return {
        success: false,
        error: "You do not have permission to delete this message",
      };
    }

    await prisma.cohortMessage.delete({
      where: { id: messageId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete cohort message: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the message",
    };
  }
}

/**
 * Pin/unpin a cohort message (admin or instructor only)
 */
export async function pinCohortMessageAction(
  messageId: string,
  pinned: boolean
): Promise<CohortMessageActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if message exists
    const existingMessage = await prisma.cohortMessage.findUnique({
      where: { id: messageId },
      include: {
        cohort: true,
      },
    });

    if (!existingMessage) {
      return {
        success: false,
        error: "Message not found",
      };
    }

    // Instructors can only pin messages in their own cohorts
    if (user.role === "INSTRUCTOR" && existingMessage.cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this message",
      };
    }

    const message = await prisma.cohortMessage.update({
      where: { id: messageId },
      data: { pinned },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        cohort: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: message };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to pin cohort message: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error modifying the message",
    };
  }
}

/**
 * Get cohort messages (paginated, linear feed)
 */
export async function getCohortMessagesAction(params: {
  cohortId: string;
  cursor?: string;
  limit?: number;
  search?: string;
}): Promise<PaginatedResult<any>> {
  try {
    await requireAuth();

    const limit = params.limit || 50;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {
      cohortId: params.cohortId,
    };

    if (params.search) {
      where.content = {
        contains: params.search,
        mode: "insensitive",
      };
    }

    const messages = await prisma.cohortMessage.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: [
        { pinned: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort messages: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

/**
 * Mark cohort messages as read
 */
export async function markCohortMessagesAsReadAction(
  cohortId: string,
  messageIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Check if user has access to the cohort
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const isAdminOrInstructor = user.role === "ADMIN" || user.role === "INSTRUCTOR";

    if (!enrollment && !isAdminOrInstructor) {
      return {
        success: false,
        error: "You do not have access to this cohort",
      };
    }

    // Create read records for messages not yet read
    await Promise.all(
      messageIds.map(async (messageId) => {
        const existing = await prisma.cohortMessageRead.findUnique({
          where: {
            cohortMessageId_userId: {
              cohortMessageId: messageId,
              userId: user.id,
            },
          },
        });

        if (!existing) {
          await prisma.cohortMessageRead.create({
            data: {
              cohortMessageId: messageId,
              userId: user.id,
            },
          });
        }
      })
    );

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to mark messages as read: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating the messages",
    };
  }
}

/**
 * Get unread message count for a cohort
 */
export async function getCohortUnreadMessageCountAction(
  cohortId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const user = await requireAuth();

    // Check if user has access to the cohort
    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const isAdminOrInstructor = user.role === "ADMIN" || user.role === "INSTRUCTOR";

    if (!enrollment && !isAdminOrInstructor) {
      return {
        success: false,
        error: "You do not have access to this cohort",
      };
    }

    // Get all messages in the cohort
    const allMessages = await prisma.cohortMessage.findMany({
      where: { cohortId },
      select: { id: true },
    });

    const messageIds = allMessages.map((m) => m.id);

    if (messageIds.length === 0) {
      return { success: true, count: 0 };
    }

    // Get read messages
    const readMessages = await prisma.cohortMessageRead.findMany({
      where: {
        userId: user.id,
        cohortMessageId: {
          in: messageIds,
        },
      },
      select: {
        cohortMessageId: true,
      },
    });

    const readMessageIds = new Set(readMessages.map((r) => r.cohortMessageId));
    const unreadCount = messageIds.filter((id) => !readMessageIds.has(id)).length;

    return { success: true, count: unreadCount };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get unread message count: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving the number of unread messages",
    };
  }
}
