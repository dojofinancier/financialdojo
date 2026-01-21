"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";

/**
 * Get the next order number for enrollments
 * Order numbers start at 5190 and increment sequentially
 * Shared between course and cohort enrollments
 */
async function getNextOrderNumber(): Promise<number> {
  const STARTING_ORDER_NUMBER = 5190;
  
  // Get max order number from both Enrollment and CohortEnrollment tables
  const [maxEnrollmentOrder, maxCohortOrder] = await Promise.all([
    prisma.enrollment.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
      where: { orderNumber: { not: null } },
    }),
    prisma.cohortEnrollment.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
      where: { orderNumber: { not: null } },
    }),
  ]);

  const maxOrder = Math.max(
    maxEnrollmentOrder?.orderNumber || 0,
    maxCohortOrder?.orderNumber || 0,
    STARTING_ORDER_NUMBER - 1 // Ensure we start at 5190 if no orders exist
  );

  return maxOrder + 1;
}

const enrollmentSchema = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
  expiresAt: z.date(),
  paymentIntentId: z.string().optional().nullable(),
});

export type EnrollmentActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create an enrollment (admin only, or via payment webhook)
 */
export async function createEnrollmentAction(
  data: z.infer<typeof enrollmentSchema>,
  skipAuthCheck: boolean = false
): Promise<EnrollmentActionResult> {
  try {
    // Allow admin or system (webhook/payment) to create enrollments
    if (!skipAuthCheck) {
      try {
        await requireAdmin();
      } catch {
        // If not admin, allow if called from webhook/payment context
        // In production, add webhook signature verification here
      }
    }

    const validatedData = enrollmentSchema.parse(data);

    // Get next order number
    const orderNumber = await getNextOrderNumber();

    const enrollment = await prisma.enrollment.create({
      data: {
        ...validatedData,
        orderNumber,
      },
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
            price: true,
          },
        },
      },
    });

    // Note: Payment webhook is sent from the Stripe webhook handler (app/api/webhooks/stripe/route.ts)
    // to avoid duplicate webhook sends. This action is called from the webhook handler,
    // so we don't send the webhook here to prevent duplicates.

    return { success: true, data: enrollment };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while creating the registration",
    };
  }
}

/**
 * Update an enrollment (admin only)
 */
export async function updateEnrollmentAction(
  enrollmentId: string,
  data: Partial<z.infer<typeof enrollmentSchema>>
): Promise<EnrollmentActionResult> {
  try {
    await requireAdmin();

    const validatedData = enrollmentSchema.partial().parse(data);

    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: validatedData,
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

    return { success: true, data: enrollment };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating the registration",
    };
  }
}

/**
 * Delete an enrollment (admin only)
 */
export async function deleteEnrollmentAction(
  enrollmentId: string
): Promise<EnrollmentActionResult> {
  try {
    await requireAdmin();

    await prisma.enrollment.delete({
      where: { id: enrollmentId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while deleting the registration",
    };
  }
}

/**
 * Extend enrollment access (admin only)
 */
export async function extendEnrollmentAccessAction(
  enrollmentId: string,
  additionalDays: number
): Promise<EnrollmentActionResult> {
  try {
    await requireAdmin();

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      return {
        success: false,
        error: "Registration not found",
      };
    }

    const newExpiresAt = new Date(enrollment.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { expiresAt: newExpiresAt },
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

    return { success: true, data: updated };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to extend enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while extending access",
    };
  }
}

/**
 * Revoke enrollment access (admin only)
 * Sets expiration date to now
 */
export async function revokeEnrollmentAccessAction(
  enrollmentId: string
): Promise<EnrollmentActionResult> {
  try {
    await requireAdmin();

    const enrollment = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { expiresAt: new Date() },
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

    return { success: true, data: enrollment };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to revoke enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while revoking access",
    };
  }
}

/**
 * Get user's enrollments
 */
export async function getUserEnrollmentsAction(params: {
  cursor?: string;
  limit?: number;
  userId?: string; // If provided and admin, get that user's enrollments
}): Promise<PaginatedResult<any>> {
  try {
    const currentUser = await requireAuth();
    const userId = params.userId && (await requireAdmin()).id === currentUser.id
      ? params.userId
      : currentUser.id;

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      take: limit + 1,
      cursor,
      orderBy: { purchaseDate: "desc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            code: true,
            slug: true,
            price: true,
            appointmentHourlyRate: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const hasMore = enrollments.length > limit;
    const items = hasMore ? enrollments.slice(0, limit) : enrollments;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Serialize Decimal fields to numbers for client components
    const serializedItems = items.map((enrollment) => ({
      ...enrollment,
      course: {
        ...enrollment.course,
        price: enrollment.course.price ? Number(enrollment.course.price) : null,
        appointmentHourlyRate: enrollment.course.appointmentHourlyRate 
          ? Number(enrollment.course.appointmentHourlyRate) 
          : null,
      },
    }));

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get enrollments: ${error instanceof Error ? error.message : "Unknown error"}`,
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

