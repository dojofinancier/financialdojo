"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { Decimal } from "@prisma/client/runtime/library";
import { getEasternNow, isPastInEastern } from "@/lib/utils/timezone";
import {
  sendAppointmentCreatedWebhook,
  sendAppointmentCancelledWebhook,
  sendAppointmentRescheduledWebhook,
} from "@/lib/webhooks/make";

const appointmentSchema = z.object({
  courseId: z.string().optional().nullable(),
  contentItemId: z.string().optional().nullable(),
  scheduledAt: z.date(),
  durationMinutes: z.number().int().refine((val) => [60, 90, 120].includes(val), {
    message: "Duration must be 60, 90, or 120 minutes",
  }).optional(),
  notes: z.string().optional().nullable(),
  paymentIntentId: z.string().optional(),
  amount: z.number().optional(),
});

export type AppointmentActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create an appointment (student only)
 */
export async function createAppointmentAction(
  data: z.infer<typeof appointmentSchema>
): Promise<AppointmentActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can create appointments",
      };
    }

    const validatedData = appointmentSchema.parse(data);

    // Check if scheduled time is in the future (using Eastern Time)
    if (isPastInEastern(validatedData.scheduledAt) || validatedData.scheduledAt <= getEasternNow()) {
      return {
        success: false,
        error: "The appointment date must be in the future",
      };
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        courseId: validatedData.courseId,
        contentItemId: validatedData.contentItemId,
        scheduledAt: validatedData.scheduledAt,
        durationMinutes: validatedData.durationMinutes || 60,
        notes: validatedData.notes,
        paymentIntentId: validatedData.paymentIntentId,
        amount: validatedData.amount ? new Decimal(validatedData.amount.toString()) : null,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Format date and time for webhook
    const scheduledDate = new Date(appointment.scheduledAt);
    const formattedDate = scheduledDate.toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Toronto'
    });
    const formattedTime = scheduledDate.toLocaleTimeString('fr-CA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Toronto',
      hour12: false
    });

    // Send webhook to make.com for calendar integration (non-blocking)
    sendAppointmentCreatedWebhook({
      appointmentId: appointment.id,
      userId: user.id,
      studentEmail: user.email,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      courseId: appointment.courseId || null,
      courseTitle: appointment.course?.title || 'Not specified',
      contentItemId: appointment.contentItemId || null,
      contentItemTitle: null, // ContentItem has no stored title; computed elsewhere.
      scheduledAt: appointment.scheduledAt.toISOString(),
      scheduledDate: formattedDate,
      scheduledTime: formattedTime,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      timestamp: new Date().toISOString(),
    }).catch((error) => {
      console.error("Failed to send appointment created webhook:", error);
    });

    return { success: true, data: appointment };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create appointment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error creating appointment",
    };
  }
}

/**
 * Get appointments (students see their own, admins see all)
 */
export async function getAppointmentsAction(params: {
  cursor?: string;
  limit?: number;
  status?: string;
  userId?: string; // Admin can filter by user
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<PaginatedResult<any>> {
  try {
    const user = await requireAuth();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {};

    // Students can only see their own appointments
    if (user.role === "STUDENT") {
      where.userId = user.id;
      // Students should only see confirmed/completed/cancelled appointments
      // PENDING appointments are only visible after payment is confirmed
      // Only exclude PENDING if no explicit status filter is provided
      if (!params.status) {
        where.status = { not: "PENDING" };
      }
    } else if (params.userId) {
      // Admin can filter by user
      where.userId = params.userId;
    }

    // Apply status filter if provided
    if (params.status) {
      where.status = params.status;
    }

    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {};
      if (params.dateFrom) {
        where.scheduledAt.gte = params.dateFrom;
      }
      if (params.dateTo) {
        where.scheduledAt.lte = params.dateTo;
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        notes: true,
        durationMinutes: true,
        amount: true,
        courseId: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
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

    const hasMore = appointments.length > limit;
    const items = hasMore ? appointments.slice(0, limit) : appointments;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Serialize Date and Decimal fields for client components
    const serializedItems = items.map((item) => ({
      ...item,
      scheduledAt: item.scheduledAt instanceof Date ? item.scheduledAt.toISOString() : item.scheduledAt,
      amount: item.amount ? Number(item.amount) : null,
    }));

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get appointments: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Update appointment (student can update their own, admin can update any)
 */
export async function updateAppointmentAction(
  appointmentId: string,
  data: Partial<z.infer<typeof appointmentSchema>> & {
    status?: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  }
): Promise<AppointmentActionResult> {
  try {
    const user = await requireAuth();

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return {
        success: false,
        error: "Rendez-vous introuvable",
      };
    }

    // Students can only update their own appointments
    if (user.role === "STUDENT" && appointment.userId !== user.id) {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const validatedData = appointmentSchema.partial().parse(data);

    // Get appointment with related data before update
    const appointmentBefore = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...validatedData,
        status: data.status,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Send webhook if appointment was cancelled
    if (data.status === "CANCELLED" && appointmentBefore) {
      sendAppointmentCancelledWebhook({
        appointmentId: updated.id,
        userId: updated.userId,
        studentEmail: updated.user.email,
        courseId: updated.courseId || null,
        courseTitle: updated.course?.title || null,
        cancelledBy: user.role === "ADMIN" ? "admin" : "student",
        cancellationReason: null,
        scheduledAt: updated.scheduledAt.toISOString(),
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to send appointment cancelled webhook:", error);
      });
    }

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update appointment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error updating appointment",
    };
  }
}

/**
 * Cancel appointment
 */
export async function cancelAppointmentAction(
  appointmentId: string
): Promise<AppointmentActionResult> {
  return updateAppointmentAction(appointmentId, {
    status: "CANCELLED",
  });
}

/**
 * Reschedule appointment (student only)
 */
export async function rescheduleAppointmentAction(
  appointmentId: string,
  newScheduledAt: Date,
  reason: string
): Promise<AppointmentActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can reschedule appointments",
      };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return {
        success: false,
        error: "Rendez-vous introuvable",
      };
    }

    // Check if user owns this appointment
    if (appointment.userId !== user.id) {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    // Check if appointment is in the future
    const now = getEasternNow();
    const appointmentDate = new Date(appointment.scheduledAt);
    if (appointmentDate <= now) {
      return {
        success: false,
        error: "Cannot reschedule a past appointment",
      };
    }

    // Check 2-hour rescheduling policy
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (appointmentDate <= twoHoursFromNow) {
      return {
        success: false,
        error: "Impossible de reprogrammer moins de 2 heures avant le rendez-vous",
      };
    }

    // Check if already cancelled or completed
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      return {
        success: false,
        error: "This appointment cannot be rescheduled",
      };
    }

    // Check if new time slot is in the future
    if (isPastInEastern(newScheduledAt) || newScheduledAt <= getEasternNow()) {
      return {
        success: false,
        error: "The new date must be in the future",
      };
    }

    // Calculate end time based on duration
    const endTime = new Date(newScheduledAt.getTime() + appointment.durationMinutes * 60 * 1000);

    // Check for conflicting appointments (same course, overlapping time)
    // We need to check all appointments and calculate their end times to detect overlaps
    if (appointment.courseId) {
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          courseId: appointment.courseId,
          status: { in: ["PENDING", "CONFIRMED"] },
          id: { not: appointmentId },
        },
      });

      // Check if any existing appointment overlaps with the new time slot
      const hasConflict = existingAppointments.some((existing) => {
        const existingStart = new Date(existing.scheduledAt);
        const existingEnd = new Date(existingStart.getTime() + existing.durationMinutes * 60 * 1000);
        
        // Check if time ranges overlap
        return (
          (newScheduledAt >= existingStart && newScheduledAt < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd) ||
          (newScheduledAt <= existingStart && endTime >= existingEnd)
        );
      });

      if (hasConflict) {
        return {
          success: false,
          error: "This time slot is not available",
        };
      }
    }

    // Get course info for webhook
    const course = appointment.courseId
      ? await prisma.course.findUnique({
          where: { id: appointment.courseId },
          select: { id: true, title: true },
        })
      : null;

    // Get user info for webhook
    const student = await prisma.user.findUnique({
      where: { id: appointment.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt: newScheduledAt,
        notes: reason ? `${appointment.notes || ""}\n\n[Reprogrammé] ${reason}`.trim() : appointment.notes,
      },
    });

    // Send webhook notification for calendar integration (non-blocking)
    if (student) {
      sendAppointmentRescheduledWebhook({
        appointmentId: updated.id,
        userId: updated.userId,
        studentEmail: student.email,
        courseId: appointment.courseId || null,
        rescheduledBy: "student",
        reason: reason || "No reason provided",
        oldScheduledAt: appointment.scheduledAt.toISOString(),
        newScheduledAt: updated.scheduledAt.toISOString(),
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to send appointment rescheduled webhook:", error);
      });
    }

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to reschedule appointment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error rescheduling appointment",
    };
  }
}

/**
 * Get appointment details (admin can view any)
 */
export async function getAppointmentDetailsAction(appointmentId: string) {
  try {
    const user = await requireAuth();

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!appointment) {
      return null;
    }

    // Students can only see their own appointments
    if (user.role === "STUDENT" && appointment.userId !== user.id) {
      return null;
    }

    return appointment;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get appointment details: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

