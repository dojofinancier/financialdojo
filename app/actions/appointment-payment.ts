"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import Stripe from "stripe";
import { Decimal } from "@prisma/client/runtime/library";
import { stripe } from "@/lib/stripe/server";
import { revalidatePath } from "next/cache";
import { sendAppointmentPaymentConfirmedWebhook } from "@/lib/webhooks/make";

const appointmentPaymentSchema = z.object({
  courseId: z.string(),
  scheduledAt: z.string().transform((str) => new Date(str)),
  durationMinutes: z.number().int().refine((val) => [60, 90, 120].includes(val)),
  notes: z.string().optional(),
});

const multipleAppointmentsPaymentSchema = z.object({
  courseId: z.string(),
  slots: z.array(z.object({
    scheduledAt: z.string().transform((str) => new Date(str)),
    durationMinutes: z.number().int().refine((val) => [60, 90, 120].includes(val)),
  })),
});

export type AppointmentPaymentActionResult = {
  success: boolean;
  error?: string;
  data?: {
    clientSecret: string;
    appointmentId: string;
    appointmentIds?: string[]; // For multiple appointments
    amount?: number; // Total amount for display
  };
};

/**
 * Create payment intent for appointment booking
 */
export async function createAppointmentPaymentIntentAction(
  data: z.input<typeof appointmentPaymentSchema>
): Promise<AppointmentPaymentActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can book appointments",
      };
    }

    const validatedData = appointmentPaymentSchema.parse(data);

    // Get course to get hourly rate
    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
      select: {
        id: true,
        title: true,
        appointmentHourlyRate: true,
      },
    });

    if (!course) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    if (!course.appointmentHourlyRate || course.appointmentHourlyRate.toNumber() === 0) {
      return {
        success: false,
        error: "This course has no hourly rate configured",
      };
    }

    // Calculate price based on duration
    const hourlyRate = course.appointmentHourlyRate.toNumber();
    const hours = validatedData.durationMinutes / 60;
    const amount = hourlyRate * hours;

    // Create appointment in PENDING status
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        courseId: validatedData.courseId,
        scheduledAt: validatedData.scheduledAt,
        durationMinutes: validatedData.durationMinutes,
        notes: validatedData.notes,
        status: "PENDING",
        amount: new Decimal(amount.toString()),
      },
    });

    // Create Stripe PaymentIntent
    // Only allow card payments (disable Klarna, Affirm, etc.)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "cad",
      payment_method_types: ["card"], // Only allow card payments
      metadata: {
        appointmentId: appointment.id,
        userId: user.id,
        courseId: validatedData.courseId,
        type: "appointment",
      },
    });

    // Update appointment with payment intent ID
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        paymentIntentId: paymentIntent.id,
      },
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret!,
        appointmentId: appointment.id,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create appointment payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating payment",
    };
  }
}

/**
 * Create payment intent for multiple appointments
 */
export async function createMultipleAppointmentsPaymentIntentAction(
  data: z.input<typeof multipleAppointmentsPaymentSchema>
): Promise<AppointmentPaymentActionResult> {
  try {
    const user = await requireAuth();

    if (user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can book appointments",
      };
    }

    const validatedData = multipleAppointmentsPaymentSchema.parse(data);

    if (validatedData.slots.length === 0) {
      return {
        success: false,
        error: "No time slot selected",
      };
    }

    // Get course to get hourly rate
    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
      select: {
        id: true,
        title: true,
        appointmentHourlyRate: true,
      },
    });

    if (!course) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    if (!course.appointmentHourlyRate || course.appointmentHourlyRate.toNumber() === 0) {
      return {
        success: false,
        error: "This course has no hourly rate configured",
      };
    }

    const hourlyRate = course.appointmentHourlyRate.toNumber();
    let totalAmount = 0;
    const appointmentIds: string[] = [];

    // Create all appointments in PENDING status
    for (const slot of validatedData.slots) {
      const hours = slot.durationMinutes / 60;
      const amount = hourlyRate * hours;
      totalAmount += amount;

      const appointment = await prisma.appointment.create({
        data: {
          userId: user.id,
          courseId: validatedData.courseId,
          scheduledAt: slot.scheduledAt,
          durationMinutes: slot.durationMinutes,
          status: "PENDING",
          amount: new Decimal(amount.toString()),
        },
      });

      appointmentIds.push(appointment.id);
    }

    // Create a single Stripe PaymentIntent for the total amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "cad",
      payment_method_types: ["card"], // Only allow card payments
      metadata: {
        userId: user.id,
        courseId: validatedData.courseId,
        type: "appointment",
        appointmentIds: appointmentIds.join(","), // Store all appointment IDs
        appointmentCount: appointmentIds.length.toString(),
      },
    });

    // Update all appointments with payment intent ID
    await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: {
        paymentIntentId: paymentIntent.id,
      },
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret!,
        appointmentId: appointmentIds[0], // Return first ID for backward compatibility
        appointmentIds, // Return all IDs
        amount: totalAmount, // Return total amount for display
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create multiple appointments payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating payment",
    };
  }
}

/**
 * Confirm appointment payment and update status
 */
export async function confirmAppointmentPaymentAction(
  appointmentId: string,
  paymentIntentId: string
) {
  try {
    const user = await requireAuth();

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        error: "Payment was not confirmed",
      };
    }

    // Check if this payment intent has multiple appointments
    const appointmentIdsStr = paymentIntent.metadata.appointmentIds;
    const appointmentIds = appointmentIdsStr ? appointmentIdsStr.split(",") : [appointmentId];

    // Update all appointments linked to this payment intent to CONFIRMED
    const appointments = await prisma.appointment.findMany({
      where: {
        id: { in: appointmentIds },
        userId: user.id,
        paymentIntentId: paymentIntentId,
      },
    });

    if (appointments.length === 0) {
      return {
        success: false,
        error: "Rendez-vous introuvable",
      };
    }

    // Update all appointments status to CONFIRMED
    await prisma.appointment.updateMany({
      where: {
        id: { in: appointmentIds },
        userId: user.id,
        paymentIntentId: paymentIntentId,
      },
      data: {
        status: "CONFIRMED",
      },
    });

    // Revalidate the appointments page to ensure fresh data
    revalidatePath("/dashboard/student", "page");

    // Send webhook to make.com for calendar integration (non-blocking)
    // Send for each appointment that was confirmed
    for (const appointment of appointments) {
      const appointmentWithDetails = await prisma.appointment.findUnique({
        where: { id: appointment.id },
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

      if (appointmentWithDetails && appointmentWithDetails.user) {
        // Format date and time for webhook
        const scheduledDate = new Date(appointmentWithDetails.scheduledAt);
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

        sendAppointmentPaymentConfirmedWebhook({
          appointmentId: appointmentWithDetails.id,
          paymentIntentId: paymentIntentId,
          userId: appointmentWithDetails.userId,
          studentEmail: appointmentWithDetails.user.email,
          studentName: `${appointmentWithDetails.user.firstName || ''} ${appointmentWithDetails.user.lastName || ''}`.trim() || appointmentWithDetails.user.email,
          courseId: appointmentWithDetails.courseId || null,
          courseTitle: appointmentWithDetails.course?.title || 'Not specified',
          scheduledAt: appointmentWithDetails.scheduledAt.toISOString(),
          scheduledDate: formattedDate,
          scheduledTime: formattedTime,
          durationMinutes: appointmentWithDetails.durationMinutes,
          amount: appointmentWithDetails.amount ? parseFloat(appointmentWithDetails.amount.toString()) : 0,
          confirmedAt: new Date().toISOString(),
        }).catch((error) => {
          console.error("Failed to send appointment payment confirmed webhook:", error);
        });
      }
    }

    return { success: true, data: { appointmentIds } };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to confirm appointment payment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error confirming payment",
    };
  }
}

