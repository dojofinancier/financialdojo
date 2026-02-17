"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/server";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import type Stripe from "stripe";

export type OrderActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all orders/transactions (admin only)
 * Orders are enrollments with paymentIntentId
 */
export async function getOrdersAction(params: {
  cursor?: string;
  limit?: number;
  userId?: string;
  courseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: "completed" | "pending" | "refunded" | "failed";
}): Promise<PaginatedResult<any>> {
  try {
    await requireAdmin();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {
      paymentIntentId: { not: null },
    };

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.courseId) {
      where.courseId = params.courseId;
    }

    if (params.dateFrom || params.dateTo) {
      where.purchaseDate = {};
      if (params.dateFrom) {
        where.purchaseDate.gte = params.dateFrom;
      }
      if (params.dateTo) {
        where.purchaseDate.lte = params.dateTo;
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { purchaseDate: "desc" },
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
            price: true,
          },
        },
        couponUsage: {
          include: {
            coupon: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    });

    // Fetch Stripe payment intent status for each enrollment
    const ordersWithStatus = await Promise.all(
      enrollments.map(async (enrollment) => {
        let paymentStatus = "succeeded";
        let refunded = false;

        if (enrollment.paymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              enrollment.paymentIntentId
            );
            paymentStatus = paymentIntent.status;

            // Check for refunds
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge?.id;
            if (chargeId) {
              const charge = await stripe.charges.retrieve(chargeId);
              if (charge.amount_refunded > 0) refunded = true;
            }
          } catch (error) {
            // Payment intent might not exist or be accessible
            console.error("Error fetching payment intent:", error);
          }
        }

        // Filter by status if specified
        if (params.status) {
          if (params.status === "refunded" && !refunded) return null;
          if (params.status === "completed" && paymentStatus !== "succeeded") return null;
          if (params.status === "pending" && paymentStatus !== "requires_payment_method" && paymentStatus !== "requires_confirmation") return null;
          if (params.status === "failed" && paymentStatus !== "canceled" && paymentStatus !== "payment_failed") return null;
        }

        return {
          ...enrollment,
          course: enrollment.course
            ? {
              ...enrollment.course,
              price: enrollment.course.price.toNumber(),
            }
            : enrollment.course,
          couponUsage: enrollment.couponUsage
            ? {
              ...enrollment.couponUsage,
              discountAmount: enrollment.couponUsage.discountAmount.toNumber(),
              coupon: enrollment.couponUsage.coupon
                ? {
                  ...enrollment.couponUsage.coupon,
                }
                : enrollment.couponUsage.coupon,
            }
            : enrollment.couponUsage,
          paymentStatus,
          refunded,
        };
      })
    );

    const filteredOrders = ordersWithStatus.filter((order) => order !== null);
    const hasMore = enrollments.length > limit;
    const items = hasMore ? filteredOrders.slice(0, limit) : filteredOrders;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items: items as any[],
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get orders: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get order details (admin only)
 */
export async function getOrderDetailsAction(enrollmentId: string) {
  try {
    await requireAdmin();

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
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
          include: {
            category: true,
          },
        },
        couponUsage: {
          include: {
            coupon: true,
          },
        },
      },
    });

    if (!enrollment || !enrollment.paymentIntentId) {
      return null;
    }

    // Serialize Decimal fields for client components
    const serializedEnrollment = {
      ...enrollment,
      course: enrollment.course
        ? {
          ...enrollment.course,
          price: enrollment.course.price.toNumber(),
        }
        : enrollment.course,
      couponUsage: enrollment.couponUsage
        ? {
          ...enrollment.couponUsage,
          discountAmount: enrollment.couponUsage.discountAmount.toNumber(),
          coupon: enrollment.couponUsage.coupon
            ? {
              ...enrollment.couponUsage.coupon,
            }
            : enrollment.couponUsage.coupon,
        }
        : enrollment.couponUsage,
    };

    // Fetch Stripe payment intent details
    let paymentIntent: Stripe.PaymentIntent | null = null;
    let refunds: Stripe.Refund[] = [];

    try {
      paymentIntent = await stripe.paymentIntents.retrieve(
        enrollment.paymentIntentId
      );

      // Get refunds if any
      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;
      if (chargeId) {
        const refundsList = await stripe.refunds.list({ charge: chargeId });
        refunds = refundsList.data;
      }
    } catch (error) {
      console.error("Error fetching payment intent:", error);
    }

    return {
      enrollment: serializedEnrollment,
      paymentIntent,
      refunds,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get order details: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Process refund (admin only)
 */
export async function processRefundAction(
  enrollmentId: string,
  amount?: number // If not provided, full refund
): Promise<OrderActionResult> {
  try {
    await requireAdmin();

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment || !enrollment.paymentIntentId) {
      return {
        success: false,
        error: "Registration or payment not found",
      };
    }

    // Get payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(
      enrollment.paymentIntentId
    );

    const chargeId =
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;

    if (!chargeId) {
      return {
        success: false,
        error: "No payment found for this registration",
      };
    }

    // Process refund via Stripe
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount ? Math.round(amount * 100) : undefined, // Stripe uses cents
    });

    return {
      success: true,
      data: {
        refund,
        enrollment,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to process refund: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error processing the refund",
    };
  }
}

