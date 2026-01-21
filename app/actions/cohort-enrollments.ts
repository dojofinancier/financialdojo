"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { sendCohortEnrollmentWebhook } from "@/lib/webhooks/make";
import { stripe } from "@/lib/stripe/server";

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

const cohortEnrollmentSchema = z.object({
  userId: z.string().min(1),
  cohortId: z.string().min(1),
  expiresAt: z.date(),
  paymentIntentId: z.string().optional().nullable(),
});

export type CohortEnrollmentActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a cohort enrollment (admin only, or via payment webhook)
 */
export async function createCohortEnrollmentAction(
  data: z.infer<typeof cohortEnrollmentSchema>
): Promise<CohortEnrollmentActionResult> {
  try {
    // Allow admin or system (webhook) to create enrollments
    try {
      await requireAdmin();
    } catch {
      // If not admin, allow if called from webhook context
      // In production, add webhook signature verification here
    }

    const validatedData = cohortEnrollmentSchema.parse(data);

    // Check if cohort exists and has space
    const cohort = await prisma.cohort.findUnique({
      where: { id: validatedData.cohortId },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Check max students
    if (cohort._count.enrollments >= cohort.maxStudents) {
      return {
        success: false,
        error: "The cohort has reached the maximum number of students",
      };
    }

    // Check enrollment closing date
    if (new Date() > cohort.enrollmentClosingDate) {
      return {
        success: false,
        error: "The registration deadline has passed",
      };
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: validatedData.userId,
        cohortId: validatedData.cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingEnrollment) {
      return {
        success: false,
        error: "The user is already enrolled in this cohort",
      };
    }

    // Get next order number
    const orderNumber = await getNextOrderNumber();

    const enrollment = await prisma.cohortEnrollment.create({
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
        cohort: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    // Send webhooks to make.com (non-blocking, fire-and-forget)
    // This ensures webhooks fire for both new users (checkout) and logged-in users
    // Don't await - let them run in the background without blocking the response
    
    // Send cohort enrollment webhook
    // Fetch amount from payment intent if available, otherwise use cohort price
    (async () => {
      let amount: number | null = null;
      
      if (enrollment.paymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(enrollment.paymentIntentId);
          const metadata = paymentIntent.metadata || {};
          // Try to get finalAmount from metadata (in dollars), otherwise convert from cents
          const finalAmount = parseFloat(metadata.finalAmount || "0");
          amount = finalAmount || paymentIntent.amount / 100; // Convert cents to dollars if needed
        } catch (error) {
          // If payment intent retrieval fails, fall back to cohort price
          console.warn("Failed to fetch payment intent for cohort enrollment webhook:", error);
        }
      }
      
      // Fallback to cohort price if no payment intent amount
      if (amount === null || amount === 0) {
        amount = Number(enrollment.cohort.price);
      }

      sendCohortEnrollmentWebhook({
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        userEmail: enrollment.user.email,
        userName: `${enrollment.user.firstName || ''} ${enrollment.user.lastName || ''}`.trim() || enrollment.user.email,
        cohortId: enrollment.cohortId,
        cohortTitle: enrollment.cohort.title,
        paymentIntentId: enrollment.paymentIntentId || "",
        amount: amount,
        expiresAt: enrollment.expiresAt.toISOString(),
        createdAt: enrollment.purchaseDate.toISOString(),
      }).catch((error) => {
        // Silently fail - webhook is not critical for UX
        console.error("Failed to send cohort enrollment webhook:", error);
      });
    })();

    // Note: Payment webhook is sent from the Stripe webhook handler (app/api/webhooks/stripe/route.ts)
    // to avoid duplicate webhook sends. This action is called from the webhook handler,
    // so we don't send the webhook here to prevent duplicates.

    // Convert Decimal to number for serialization
    return {
      success: true,
      data: {
        ...enrollment,
        cohort: enrollment.cohort
          ? {
              ...enrollment.cohort,
              price: Number(enrollment.cohort.price),
            }
          : null,
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
      errorMessage: `Failed to create cohort enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Update a cohort enrollment (admin only)
 */
export async function updateCohortEnrollmentAction(
  enrollmentId: string,
  data: Partial<z.infer<typeof cohortEnrollmentSchema>>
): Promise<CohortEnrollmentActionResult> {
  try {
    await requireAdmin();

    const validatedData = cohortEnrollmentSchema.partial().parse(data);

    const enrollment = await prisma.cohortEnrollment.update({
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
        cohort: {
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
      errorMessage: `Failed to update cohort enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Delete a cohort enrollment (admin only)
 */
export async function deleteCohortEnrollmentAction(
  enrollmentId: string
): Promise<CohortEnrollmentActionResult> {
  try {
    await requireAdmin();

    await prisma.cohortEnrollment.delete({
      where: { id: enrollmentId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete cohort enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get cohort enrollments (admin only)
 */
export async function getCohortEnrollmentsAction(
  cohortId: string
): Promise<CohortEnrollmentActionResult> {
  try {
    await requireAdmin();

    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { cohortId },
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
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: enrollments };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort enrollments: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while retrieving registrations",
    };
  }
}

/**
 * Extend cohort enrollment access (admin only)
 */
export async function extendCohortEnrollmentAccessAction(
  enrollmentId: string,
  additionalDays: number
): Promise<CohortEnrollmentActionResult> {
  try {
    await requireAdmin();

    const enrollment = await prisma.cohortEnrollment.findUnique({
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

    const updated = await prisma.cohortEnrollment.update({
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
        cohort: {
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
      errorMessage: `Failed to extend cohort enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Revoke cohort enrollment access (admin only)
 * Sets expiration date to now
 */
export async function revokeCohortEnrollmentAccessAction(
  enrollmentId: string
): Promise<CohortEnrollmentActionResult> {
  try {
    await requireAdmin();

    const enrollment = await prisma.cohortEnrollment.update({
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
        cohort: {
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
      errorMessage: `Failed to revoke cohort enrollment: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get user's cohort enrollments
 */
export async function getUserCohortEnrollmentsAction(params: {
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

    const enrollments = await prisma.cohortEnrollment.findMany({
      where: { userId },
      take: limit + 1,
      cursor,
      orderBy: { purchaseDate: "desc" },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
            slug: true,
            instructor: {
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

    const hasMore = enrollments.length > limit;
    const items = hasMore ? enrollments.slice(0, limit) : enrollments;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Serialize Decimal fields to numbers for client components
    const serializedItems = items.map((enrollment) => ({
      ...enrollment,
      cohort: enrollment.cohort ? {
        ...enrollment.cohort,
        // Note: cohort doesn't have price in the select, but serialize any Decimal fields if they exist
      } : undefined,
    }));

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort enrollments: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Check if user has access to a cohort
 */
export async function checkCohortAccessAction(
  cohortId: string
): Promise<{ hasAccess: boolean; enrollment?: any }> {
  try {
    const user = await requireAuth();

    const enrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        cohort: true,
      },
    });

    return {
      hasAccess: !!enrollment,
      enrollment: enrollment || undefined,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to check cohort access: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      hasAccess: false,
    };
  }
}

/**
 * Check if cohort can accept new enrollments
 */
export async function checkCohortEnrollmentAvailabilityAction(
  cohortId: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!cohort) {
      return {
        available: false,
        reason: "Cohort not found",
      };
    }

    if (cohort._count.enrollments >= cohort.maxStudents) {
      return {
        available: false,
        reason: "The cohort has reached the maximum number of students",
      };
    }

    if (new Date() > cohort.enrollmentClosingDate) {
      return {
        available: false,
        reason: "The registration deadline has passed",
      };
    }

    return {
      available: true,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to check cohort enrollment availability: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      available: false,
      reason: "Error while verifying",
    };
  }
}

