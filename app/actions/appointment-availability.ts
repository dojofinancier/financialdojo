"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import { getEasternNow } from "@/lib/utils/timezone";

const availabilitySchema = z.object({
  courseId: z.string().optional().nullable(),
  startTime: z.string().transform((str) => new Date(str)),
  endTime: z.string().transform((str) => new Date(str)),
  durationMinutes: z.union([
    z.enum(["60", "90", "120"]),
    z.number().int().refine((val) => [60, 90, 120].includes(val)),
  ]).transform((val) => typeof val === "string" ? parseInt(val, 10) : val),
});

export type AppointmentAvailabilityActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create appointment availability slot (admin only)
 */
export async function createAvailabilityAction(
  data: z.infer<typeof availabilitySchema>
): Promise<AppointmentAvailabilityActionResult> {
  try {
    await requireAdmin();
    const validatedData = availabilitySchema.parse(data);

    // Validate duration is 60, 90, or 120
    if (![60, 90, 120].includes(validatedData.durationMinutes)) {
      return {
        success: false,
        error: "Duration must be 60, 90, or 120 minutes",
      };
    }

    // Validate end time is after start time
    if (validatedData.endTime <= validatedData.startTime) {
      return {
        success: false,
        error: "End time must be after start time",
      };
    }

    const availability = await prisma.appointmentAvailability.create({
      data: {
        courseId: validatedData.courseId || null,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        durationMinutes: validatedData.durationMinutes,
        isAvailable: true,
      },
    });

    return { success: true, data: availability };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues && error.issues.length > 0 ? error.issues[0] : null;
      return {
        success: false,
        error: firstError?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create availability: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error creating availability",
    };
  }
}

/**
 * Get available time slots for a course (or all courses if courseId is null)
 */
export async function getAvailabilityAction(courseId?: string | null) {
  try {
    const where: any = {
      isAvailable: true,
      startTime: {
        gte: getEasternNow(), // Only future slots (using Eastern Time)
      },
    };

    if (courseId) {
      where.courseId = courseId;
    }

    const availabilities = await prisma.appointmentAvailability.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            appointmentHourlyRate: true,
          },
        },
      },
    });

    return availabilities;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get availability: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}

/**
 * Delete availability slot (admin only)
 */
export async function deleteAvailabilityAction(
  availabilityId: string
): Promise<AppointmentAvailabilityActionResult> {
  try {
    await requireAdmin();

    await prisma.appointmentAvailability.delete({
      where: { id: availabilityId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete availability: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error deleting availability",
    };
  }
}

/**
 * Check if a time slot is available (not conflicting with existing appointments)
 */
export async function checkSlotAvailabilityAction(
  startTime: Date,
  durationMinutes: number
): Promise<{ available: boolean; reason?: string }> {
  try {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // Check for conflicting appointments
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        status: {
          not: "CANCELLED",
        },
        scheduledAt: {
          lt: endTime,
        },
        // Check if appointment end time overlaps
        // We need to calculate appointment end time based on duration
        // For now, we'll check if start times are too close (within duration)
      },
    });

    // Check for conflicting availability slots
    const conflictingAvailability = await prisma.appointmentAvailability.findFirst({
      where: {
        isAvailable: true,
        startTime: {
          lte: endTime,
        },
        endTime: {
          gte: startTime,
        },
      },
    });

    if (!conflictingAvailability) {
      return {
        available: false,
        reason: "No availability found for this time slot",
      };
    }

    // Check if there are existing appointments in this time range
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
        scheduledAt: {
          gte: startTime,
          lt: endTime,
        },
      },
    });

    if (existingAppointments.length > 0) {
      return {
        available: false,
        reason: "This time slot is already booked",
      };
    }

    return { available: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to check slot availability: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      available: false,
      reason: "Error checking availability",
    };
  }
}

