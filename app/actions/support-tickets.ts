"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { randomUUID } from "crypto";
import { unstable_cache, revalidateTag } from "next/cache";
import {
  sendTicketCreatedWebhook,
  sendTicketReplyWebhook,
  sendTicketStatusChangedWebhook,
} from "@/lib/webhooks/make";

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  description: z.string().min(1, "La description est requise"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  category: z.string().optional().nullable(),
});

const ticketReplySchema = z.object({
  message: z.string().min(1, "Message is required"),
  attachments: z.array(z.string()).optional().nullable(),
});

export type SupportTicketActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a support ticket (student only)
 */
export async function createSupportTicketAction(
  data: z.infer<typeof ticketSchema>
): Promise<SupportTicketActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can create tickets",
      };
    }

    const validatedData = ticketSchema.parse(data);

    // Generate unique ticket number (UUID-based)
    const ticketNumber = `TICKET-${randomUUID().split("-")[0].toUpperCase()}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        studentId: user.id,
        ...validatedData,
      },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Invalidate cache for this user's tickets
    revalidateTag(`support-tickets-${user.id}`, "max");

    // Send webhook to make.com for notifications (non-blocking)
    sendTicketCreatedWebhook({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: ticket.student.id,
      userEmail: ticket.student.email,
      userName: `${ticket.student.firstName} ${ticket.student.lastName}`,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category || "",
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
    }).catch((error) => {
      // Don't fail if webhook fails, just log to console
      console.error("Failed to send ticket created webhook:", error);
    });

    return { success: true, data: ticket };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false,
        error: firstError?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create support ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error creating the ticket",
    };
  }
}

/**
 * Get support tickets (admin sees all, students see only their own)
 */
/**
 * Internal function to fetch tickets from database
 * This is cached separately to allow for user-specific caching
 */
async function fetchSupportTicketsFromDB(
  userId: string,
  userRole: string,
  params: {
    cursor?: string;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    assignedAdminId?: string;
    search?: string;
  }
): Promise<PaginatedResult<any>> {
  const limit = params.limit || 20;
  const cursor = params.cursor ? { id: params.cursor } : undefined;

  const where: any = {};

  // Students can only see their own tickets
  if (userRole === "STUDENT") {
    where.studentId = userId;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.priority) {
    where.priority = params.priority;
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.assignedAdminId) {
    where.assignedAdminId = params.assignedAdminId;
  }

  if (params.search) {
    where.OR = [
      { ticketNumber: { contains: params.search, mode: "insensitive" } },
      { subject: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Optimized: Use select instead of include, fetch reply counts separately
  const tickets = await prisma.supportTicket.findMany({
    where,
    take: limit + 1,
    cursor,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ticketNumber: true,
      studentId: true,
      assignedAdminId: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get related data in parallel
  const hasMore = tickets.length > limit;
  const items = hasMore ? tickets.slice(0, limit) : tickets;
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  const ticketIds = items.map((t) => t.id);
  const userIds = [
    ...items.map((t) => t.studentId),
    ...items.map((t) => t.assignedAdminId).filter(Boolean),
  ].filter(Boolean) as string[];

  const [replyCounts, users] = await Promise.all([
    // Get reply counts in batch
    ticketIds.length > 0
      ? prisma.supportTicketReply.groupBy({
          by: ["ticketId"],
          where: {
            ticketId: { in: ticketIds },
          },
          _count: {
            id: true,
          },
        })
      : [],
    // Get users in batch
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        })
      : [],
  ]);

  const replyCountMap = new Map(
    replyCounts.map((rc) => [rc.ticketId, rc._count.id])
  );
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Combine data
  const ticketsWithRelations = items.map((ticket) => ({
    ...ticket,
    student: userMap.get(ticket.studentId) || null,
    assignedAdmin: ticket.assignedAdminId
      ? userMap.get(ticket.assignedAdminId) || null
      : null,
    _count: {
      replies: replyCountMap.get(ticket.id) || 0,
    },
  }));

  return {
    items: ticketsWithRelations,
    nextCursor,
    hasMore,
  };
}

export async function getSupportTicketsAction(params: {
  cursor?: string;
  limit?: number;
  status?: string;
  priority?: string;
  category?: string;
  assignedAdminId?: string;
  search?: string;
}): Promise<PaginatedResult<any>> {
  try {
    // Use getCurrentUser instead of requireAuth to avoid redirects in client-called actions
    const user = await getCurrentUser();
    
    if (!user) {
      // Return empty result instead of redirecting (client will handle auth)
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    // Skip caching if there's a search query (results should be fresh)
    // Also skip caching for filtered results to ensure accuracy
    const shouldCache = !params.search && !params.status && !params.priority && !params.category && !params.assignedAdminId;

    if (shouldCache) {
      // Cache for 30 seconds - short enough to feel fresh, long enough for quick revisits
      const cachedFetch = unstable_cache(
        async () => fetchSupportTicketsFromDB(user.id, user.role, params),
        [`support-tickets-${user.id}-${user.role}`, JSON.stringify(params)],
        {
          revalidate: 30, // 30 seconds
          tags: [`support-tickets-${user.id}`], // For cache invalidation
        }
      );

      return await cachedFetch();
    } else {
      // No caching for filtered/searched results
      return await fetchSupportTicketsFromDB(user.id, user.role, params);
    }
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get support tickets: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get ticket details with replies
 */
export async function getTicketDetailsAction(ticketId: string) {
  try {
    const user = await requireAuth();

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return null;
    }

    // Students can only see their own tickets
    if (user.role === "STUDENT" && ticket.studentId !== user.id) {
      return null;
    }

    return ticket;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get ticket details: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Reply to a ticket
 */
export async function replyToTicketAction(
  ticketId: string,
  data: z.infer<typeof ticketReplySchema>
): Promise<SupportTicketActionResult> {
  try {
    const user = await requireAuth();

    // Verify ticket exists and user has access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!ticket) {
      return {
        success: false,
        error: "Ticket introuvable",
      };
    }

    if (user.role === "STUDENT" && ticket.studentId !== user.id) {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const validatedData = ticketReplySchema.parse(data);

    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId,
        authorId: user.id,
        authorRole: user.role,
        message: validatedData.message,
        attachments: validatedData.attachments || undefined,
      },
    });

    // Update ticket updatedAt timestamp
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    // Invalidate cache for both student and admin (if admin replied)
    revalidateTag(`support-tickets-${ticket.student.id}`, "max");
    if (user.role === "ADMIN") {
      // Also invalidate admin's view cache
      revalidateTag(`support-tickets-${user.id}`, "max");
    }

    // Send webhook to make.com for notifications (non-blocking)
    sendTicketReplyWebhook({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      replyId: reply.id,
      userId: ticket.student.id,
      userEmail: ticket.student.email,
      userName: `${ticket.student.firstName} ${ticket.student.lastName}`,
      senderRole: user.role,
      message: reply.message,
      isInternal: user.role === "ADMIN",
      timestamp: reply.createdAt.toISOString(),
    }).catch((error) => {
      // Don't fail if webhook fails, just log to console
      console.error("Failed to send ticket reply webhook:", error);
    });

    return { success: true, data: reply };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false,
        error: firstError?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to reply to ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Update ticket status (admin only)
 */
export async function updateTicketStatusAction(
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
): Promise<SupportTicketActionResult> {
  try {
    const admin = await requireAdmin();

    // Get current ticket to capture old status
    const oldTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!oldTicket) {
      return {
        success: false,
        error: "Ticket introuvable",
      };
    }

    const oldStatus = oldTicket.status;

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Invalidate cache for student and admin
    revalidateTag(`support-tickets-${ticket.student.id}`, "max");
    revalidateTag(`support-tickets-${admin.id}`, "max");

    // Send webhook to make.com for notifications (non-blocking)
    if (oldStatus !== status) {
      sendTicketStatusChangedWebhook({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        userId: ticket.student.id,
        userEmail: ticket.student.email,
        userName: `${ticket.student.firstName} ${ticket.student.lastName}`,
        oldStatus: oldStatus,
        newStatus: status,
        changedBy: admin.id,
        reason: null,
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        // Don't fail if webhook fails, just log to console
        console.error("Failed to send ticket status changed webhook:", error);
      });
    }

    return { success: true, data: ticket };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update ticket status: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating status",
    };
  }
}

/**
 * Assign ticket to admin (admin only)
 */
export async function assignTicketAction(
  ticketId: string,
  adminId: string
): Promise<SupportTicketActionResult> {
  try {
    await requireAdmin();

    // Verify admin exists and is admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId, role: "ADMIN" },
    });

    if (!admin) {
      return {
        success: false,
        error: "Administrateur introuvable",
      };
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedAdminId: adminId },
    });

    return { success: true, data: ticket };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to assign ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error assigning the ticket",
    };
  }
}

/**
 * Update ticket priority (admin only)
 */
export async function updateTicketPriorityAction(
  ticketId: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
): Promise<SupportTicketActionResult> {
  try {
    await requireAdmin();

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });

    return { success: true, data: ticket };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update ticket priority: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating priority",
    };
  }
}

/**
 * Update ticket category (admin only)
 */
export async function updateTicketCategoryAction(
  ticketId: string,
  category: string | null
): Promise<SupportTicketActionResult> {
  try {
    await requireAdmin();

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { category },
    });

    return { success: true, data: ticket };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update ticket category: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating category",
    };
  }
}

/**
 * Get ticket statistics (admin only)
 */
export async function getTicketStatisticsAction() {
  try {
    await requireAdmin();

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      highPriorityTickets,
      ticketsByCategory,
      ticketsByAdmin,
    ] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
      prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.supportTicket.count({ where: { status: "RESOLVED" } }),
      prisma.supportTicket.count({ where: { status: "CLOSED" } }),
      prisma.supportTicket.count({ where: { priority: "URGENT" } }),
      prisma.supportTicket.count({ where: { priority: "HIGH" } }),
      prisma.supportTicket.groupBy({
        by: ["category"],
        _count: true,
        where: { category: { not: null } },
      }),
      prisma.supportTicket.groupBy({
        by: ["assignedAdminId"],
        _count: true,
        where: { assignedAdminId: { not: null } },
      }),
    ]);

    return {
      success: true,
      data: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        urgentTickets,
        highPriorityTickets,
        ticketsByCategory,
        ticketsByAdmin,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get ticket statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving statistics",
    };
  }
}

/**
 * Get all admin users for ticket assignment (admin only)
 */
export async function getAdminUsersAction() {
  try {
    await requireAdmin();

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { email: "asc" },
    });

    return { success: true, data: admins };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get admin users: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving administrators",
    };
  }
}

