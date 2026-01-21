"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { sendMessageWebhook, sendInstructorResponseWebhook } from "@/lib/webhooks/make";

const messageSchema = z.object({
  threadId: z.string().optional(),
  contentItemId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(), // For general course questions
  content: z.string().min(1, "Message is required"),
  attachments: z.array(z.string()).optional(), // Array of file URLs
});

export type MessageActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a message thread and send initial message (student only)
 */
export async function sendMessageAction(
  data: z.infer<typeof messageSchema>
): Promise<MessageActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can send messages",
      };
    }

    const validatedData = messageSchema.parse(data);

    // Create thread if not provided
    let threadId = validatedData.threadId;
    if (!threadId && validatedData.contentItemId) {
      // Check if there's an existing thread for this content item
      const existingMessage = await prisma.message.findFirst({
        where: {
          userId: user.id,
          contentItemId: validatedData.contentItemId,
        },
        select: {
          threadId: true,
        },
      });
      
      if (existingMessage) {
        threadId = existingMessage.threadId;
      } else {
        const thread = await prisma.messageThread.create({
          data: {
            userId: user.id,
            subject: `Question sur le contenu`,
            status: "OPEN",
          },
        });
        threadId = thread.id;
      }
    } else if (!threadId) {
      const thread = await prisma.messageThread.create({
        data: {
          userId: user.id,
          subject: `Question sur le contenu`,
          status: "OPEN",
        },
      });
      threadId = thread.id;
    }

    // Fetch course and content item information BEFORE creating message
    let courseId: string | null = validatedData.courseId || null;
    let courseTitle: string | null = null;
    let contentItemTitle: string | null = null;

    // If contentItemId is provided, fetch course info from contentItem (this takes precedence)
    if (validatedData.contentItemId) {
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: validatedData.contentItemId },
        select: {
          id: true,
          contentType: true,
          module: {
            select: {
              id: true,
              title: true,
              course: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          video: {
            select: { id: true },
          },
          quiz: {
            select: { id: true, title: true },
          },
          notes: {
            select: { id: true },
            take: 1,
          },
          learningActivity: {
            select: { id: true, title: true },
          },
        },
      });

      if (contentItem) {
        // Override courseId and courseTitle from contentItem (more specific)
        courseId = contentItem.module?.course?.id || courseId;
        courseTitle = contentItem.module?.course?.title || courseTitle;
        // Get title from the appropriate related model
        if (contentItem.quiz?.title) {
          contentItemTitle = contentItem.quiz.title;
        } else if (contentItem.learningActivity?.title) {
          contentItemTitle = contentItem.learningActivity.title;
        } else if (contentItem.module?.title) {
          contentItemTitle = contentItem.module.title;
        }
      }
    }

    // If courseId was provided directly (and not overridden by contentItem), fetch the course title
    if (courseId && !courseTitle) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
        },
      });
      if (course) {
        courseTitle = course.title;
      }
    }

    // Create message (now courseId is available)
    const message = await prisma.message.create({
      data: {
        threadId,
        userId: user.id,
        contentItemId: validatedData.contentItemId,
        courseId: courseId, // Store courseId for later retrieval
        content: validatedData.content,
        isFromStudent: true,
        attachments: validatedData.attachments || [],
      },
      include: {
        thread: true,
      },
    });

    // Update thread timestamp
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    // Find an instructor for this course (if any)
    // make.com can handle routing even if no instructor is found
    const instructor = await prisma.user.findFirst({
      where: {
        role: "INSTRUCTOR",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    // Always send webhook - make.com can handle routing even without an instructor
    sendMessageWebhook({
      messageId: message.id,
      threadId: message.threadId,
      studentId: user.id,
      studentEmail: user.email,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      instructorId: instructor?.id || null,
      instructorEmail: instructor?.email || null,
      instructorName: instructor ? `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() : null,
      content: message.content,
      contentItemId: message.contentItemId || null,
      contentItemTitle: contentItemTitle || null,
      courseId: courseId || null,
      courseTitle: courseTitle || null,
      timestamp: new Date().toISOString(),
    }).catch((error) => {
      console.error("Failed to send message webhook:", error);
    });

    return { success: true, data: { message, thread: message.thread } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error sending message",
    };
  }
}

/**
 * Get message threads for current user
 */
export async function getMessageThreadsAction(params: {
  cursor?: string;
  limit?: number;
  status?: "OPEN" | "CLOSED";
}): Promise<PaginatedResult<any>> {
  try {
    const user = await requireAuth();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {
      userId: user.id,
    };

    if (params.status) {
      where.status = params.status;
    }

    const threads = await prisma.messageThread.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            isFromStudent: true,
            createdAt: true,
          },
          // Get all messages to check for responses
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const hasMore = threads.length > limit;
    const items = hasMore ? threads.slice(0, limit) : threads;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get message threads: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get thread messages
 */
export async function getThreadMessagesAction(threadId: string) {
  try {
    const user = await requireAuth();

    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
    });

    if (!thread || thread.userId !== user.id) {
      return null;
    }

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      thread,
      messages,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get thread messages: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Reply to a message thread (admin only)
 */
export async function replyToMessageThreadAction(
  threadId: string,
  content: string
): Promise<MessageActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return {
        success: false,
        error: "Only administrators can respond",
      };
    }

    // Verify thread exists
    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return {
        success: false,
        error: "Fil de discussion introuvable",
      };
    }

    // Create reply message
    const message = await prisma.message.create({
      data: {
        threadId,
        userId: user.id,
        content,
        isFromStudent: false,
      },
    });

    // Update thread status and timestamp
    await prisma.messageThread.update({
      where: { id: threadId },
      data: {
        updatedAt: new Date(),
        status: "OPEN", // Keep open for further discussion
      },
    });

    // Get thread with student info for webhook
    const threadWithDetails = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Fetch course info from any message in thread (prefer courseId, fallback to contentItem)
    let course: { id: string; title: string } | null = null;
    if (threadWithDetails) {
      try {
        // First, try to find a message with courseId stored directly
        const messageWithCourseId = await prisma.message.findFirst({
          where: {
            threadId: threadId,
            courseId: { not: null },
          },
          select: {
            courseId: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (messageWithCourseId?.courseId) {
          const courseData = await prisma.course.findUnique({
            where: { id: messageWithCourseId.courseId },
            select: {
              id: true,
              title: true,
            },
          });
          course = courseData;
        } else {
          // Fallback: Find message with contentItemId
          const messageWithContentItem = await prisma.message.findFirst({
            where: {
              threadId: threadId,
              contentItemId: { not: null },
            },
            select: {
              contentItemId: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });

          if (messageWithContentItem?.contentItemId) {
            const contentItem = await prisma.contentItem.findUnique({
              where: { id: messageWithContentItem.contentItemId },
              select: {
                module: {
                  select: {
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            });
            course = contentItem?.module?.course || null;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch course for thread ${threadId}:`, error);
      }
    }

    // Send webhook for instructor response
    if (threadWithDetails) {
      const student = threadWithDetails.user;

      sendInstructorResponseWebhook({
        messageId: message.id,
        threadId: threadId,
        instructorId: user.id,
        instructorEmail: user.email,
        instructorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        studentId: student.id,
        studentEmail: student.email,
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email,
        content: content,
        courseId: course?.id || null,
        courseTitle: course?.title || null,
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to send instructor response webhook:", error);
      });
    }

    return { success: true, data: message };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reply to message thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error sending the response",
    };
  }
}

/**
 * Get all message threads (admin only)
 */
export async function getAllMessageThreadsAction(params: {
  cursor?: string;
  limit?: number;
  status?: "OPEN" | "CLOSED";
  search?: string;
}): Promise<PaginatedResult<any>> {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { subject: { contains: params.search, mode: "insensitive" } },
        { user: { email: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const threads = await prisma.messageThread.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get latest message
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Enrich threads with course information
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        try {
          // First, try to find a message with courseId stored directly
          const messageWithCourseId = await prisma.message.findFirst({
            where: {
              threadId: thread.id,
              courseId: { not: null },
            },
            select: {
              courseId: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });

          if (messageWithCourseId?.courseId) {
            // Fetch course directly using stored courseId
            const course = await prisma.course.findUnique({
              where: { id: messageWithCourseId.courseId },
              select: {
                id: true,
                title: true,
              },
            });

            if (course) {
              return {
                ...thread,
                course,
              };
            }
          }

          // Fallback: Find message with contentItemId and get course from contentItem
          const messageWithContentItem = await prisma.message.findFirst({
            where: {
              threadId: thread.id,
              contentItemId: { not: null },
            },
            select: {
              contentItemId: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });

          if (messageWithContentItem?.contentItemId) {
            // Fetch the contentItem separately (no relation in schema)
            const contentItem = await prisma.contentItem.findUnique({
              where: { id: messageWithContentItem.contentItemId },
              select: {
                id: true,
                module: {
                  select: {
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            });

            const course = contentItem?.module?.course || null;
            
            return {
              ...thread,
              course,
            };
          }

          return {
            ...thread,
            course: null,
          };
        } catch (error) {
          // If enrichment fails, return thread without course
          console.error(`Failed to enrich thread ${thread.id} with course:`, error);
          return {
            ...thread,
            course: null,
          };
        }
      })
    );

    const hasMore = enrichedThreads.length > limit;
    const items = hasMore ? enrichedThreads.slice(0, limit) : enrichedThreads;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get all message threads: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get thread messages (admin can view any thread)
 */
export async function getThreadMessagesAdminAction(threadId: string) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return null;
    }

    const thread = await prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!thread) {
      return null;
    }

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get course from any message in thread (prefer courseId, fallback to contentItem)
    let course: { id: string; title: string } | null = null;
    
    // First, try to find a message with courseId stored directly
    const messageWithCourseId = messages
      .filter((msg) => (msg as any).courseId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    
    if (messageWithCourseId && (messageWithCourseId as any).courseId) {
      try {
        const courseData = await prisma.course.findUnique({
          where: { id: (messageWithCourseId as any).courseId },
          select: {
            id: true,
            title: true,
          },
        });
        course = courseData;
      } catch (error) {
        console.error(`Failed to fetch course for courseId ${(messageWithCourseId as any).courseId}:`, error);
      }
    }

    // Fallback: Find message with contentItemId and get course from contentItem
    if (!course) {
      const messageWithContentItem = messages
        .filter((msg) => msg.contentItemId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      
      if (messageWithContentItem?.contentItemId) {
        try {
          const contentItem = await prisma.contentItem.findUnique({
            where: { id: messageWithContentItem.contentItemId },
            select: {
              id: true,
              module: {
                select: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          });
          course = contentItem?.module?.course || null;
        } catch (error) {
          console.error(`Failed to fetch course for contentItem ${messageWithContentItem.contentItemId}:`, error);
        }
      }
    }

    return {
      thread: {
        ...thread,
        course,
      },
      messages,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get thread messages: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Update thread status (admin only)
 */
export async function updateThreadStatusAction(
  threadId: string,
  status: "OPEN" | "CLOSED"
): Promise<MessageActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const thread = await prisma.messageThread.update({
      where: { id: threadId },
      data: { status },
    });

    return { success: true, data: thread };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update thread status: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating status",
    };
  }
}

