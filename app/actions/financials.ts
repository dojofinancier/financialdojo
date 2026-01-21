"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/server";
import { logServerError } from "@/lib/utils/error-logging";

export type FinancialActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get revenue by month and year (calendar) - net of refunds
 */
export async function getRevenueByPeriodAction(
  year: number,
  month?: number
): Promise<FinancialActionResult> {
  try {
    await requireAdmin();

    const startDate = new Date(year, month !== undefined ? month - 1 : 0, 1);
    const endDate = new Date(
      year,
      month !== undefined ? month : 12,
      0,
      23,
      59,
      59,
      999
    );

    // Get enrollments in period
    const enrollments = await prisma.enrollment.findMany({
      where: {
        paymentIntentId: { not: null },
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        course: {
          select: {
            price: true,
          },
        },
        couponUsage: {
          select: {
            discountAmount: true,
          },
        },
      },
    });

    // Calculate gross revenue
    let grossRevenue = 0;
    const courseRevenue: Record<string, number> = {};

    for (const enrollment of enrollments) {
      let amount = Number(enrollment.course.price);

      // Subtract coupon discount if any
      if (enrollment.couponUsage) {
        amount -= Number(enrollment.couponUsage.discountAmount);
      }

      grossRevenue += amount;

      // Track by course
      if (!courseRevenue[enrollment.courseId]) {
        courseRevenue[enrollment.courseId] = 0;
      }
      courseRevenue[enrollment.courseId] += amount;
    }

    // Get refunds in period - batch process for efficiency
    let totalRefunds = 0;
    const refundsByCourse: Record<string, number> = {};

    // Get unique payment intent IDs
    const paymentIntentIds = Array.from(
      new Set(enrollments.map(e => e.paymentIntentId).filter(Boolean) as string[])
    );

    // Process in batches to avoid overwhelming Stripe API
    const batchSize = 10;
    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {
      const batch = paymentIntentIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (paymentIntentId) => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge?.id;

            if (chargeId) {
              const refunds = await stripe.refunds.list({ charge: chargeId });

              // Find the enrollment(s) for this payment intent
              const relatedEnrollments = enrollments.filter(
                e => e.paymentIntentId === paymentIntentId
              );

              for (const refund of refunds.data) {
                const refundDate = new Date(refund.created * 1000);
                if (refundDate >= startDate && refundDate <= endDate) {
                  const refundAmount = refund.amount / 100; // Convert from cents
                  totalRefunds += refundAmount;

                  // Apply refund to the first enrollment (typically one payment intent = one enrollment)
                  // If multiple, apply to the first one in the period
                  if (relatedEnrollments.length > 0) {
                    const enrollment = relatedEnrollments[0];
                    if (!refundsByCourse[enrollment.courseId]) {
                      refundsByCourse[enrollment.courseId] = 0;
                    }
                    refundsByCourse[enrollment.courseId] += refundAmount;
                  }
                }
              }
            }
          } catch (error) {
            // Skip if payment intent not accessible
            console.error("Error fetching refunds:", error);
          }
        })
      );
    }

    // Calculate net revenue
    const netRevenue = grossRevenue - totalRefunds;

    // Calculate net revenue by course
    const netRevenueByCourse: Record<string, number> = {};
    for (const courseId in courseRevenue) {
      netRevenueByCourse[courseId] =
        courseRevenue[courseId] - (refundsByCourse[courseId] || 0);
    }

    return {
      success: true,
      data: {
        period: {
          year,
          month: month || null,
          startDate,
          endDate,
        },
        grossRevenue,
        totalRefunds,
        netRevenue,
        revenueByCourse: netRevenueByCourse,
        refundsByCourse,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get revenue by period: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error calculating revenues",
    };
  }
}

/**
 * Get refund statistics
 */
export async function getRefundStatisticsAction(
  year?: number,
  month?: number
): Promise<FinancialActionResult> {
  try {
    await requireAdmin();

    const startDate = year
      ? new Date(year, month !== undefined ? month - 1 : 0, 1)
      : new Date(0);
    const endDate = year
      ? new Date(
          year,
          month !== undefined ? month : 12,
          0,
          23,
          59,
          59,
          999
        )
      : new Date();

    // Get all enrollments with payment intents
    const enrollments = await prisma.enrollment.findMany({
      where: {
        paymentIntentId: { not: null },
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    let totalRefunds = 0;
    let refundCount = 0;
    const refundsByCourse: Record<string, { count: number; amount: number }> =
      {};

    // Get unique payment intent IDs and process in batches
    const paymentIntentIds = Array.from(
      new Set(enrollments.map(e => e.paymentIntentId).filter(Boolean) as string[])
    );

    const batchSize = 10;
    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {
      const batch = paymentIntentIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (paymentIntentId) => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge?.id;

            if (chargeId) {
              const refunds = await stripe.refunds.list({ charge: chargeId });

              // Find related enrollments
              const relatedEnrollments = enrollments.filter(
                e => e.paymentIntentId === paymentIntentId
              );

              for (const refund of refunds.data) {
                const refundDate = new Date(refund.created * 1000);
                if (refundDate >= startDate && refundDate <= endDate) {
                  refundCount++;
                  const refundAmount = refund.amount / 100;
                  totalRefunds += refundAmount;

                  // Apply to first enrollment (typically one payment intent = one enrollment)
                  if (relatedEnrollments.length > 0) {
                    const enrollment = relatedEnrollments[0];
                    if (!refundsByCourse[enrollment.courseId]) {
                      refundsByCourse[enrollment.courseId] = {
                        count: 0,
                        amount: 0,
                      };
                    }
                    refundsByCourse[enrollment.courseId].count++;
                    refundsByCourse[enrollment.courseId].amount += refundAmount;
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error fetching refunds:", error);
          }
        })
      );
    }

    return {
      success: true,
      data: {
        totalRefunds,
        refundCount,
        averageRefund: refundCount > 0 ? totalRefunds / refundCount : 0,
        refundsByCourse,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get refund statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error calculating refund statistics",
    };
  }
}

/**
 * Get total revenue (all-time) - net of refunds
 */
export async function getTotalRevenueAction(): Promise<FinancialActionResult> {
  try {
    await requireAdmin();

    const enrollments = await prisma.enrollment.findMany({
      where: {
        paymentIntentId: { not: null },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
        couponUsage: {
          select: {
            discountAmount: true,
          },
        },
      },
    });

    let grossRevenue = 0;
    const revenueByCourse: Record<string, { title: string; revenue: number }> = {};

    for (const enrollment of enrollments) {
      let amount = Number(enrollment.course.price);
      if (enrollment.couponUsage) {
        amount -= Number(enrollment.couponUsage.discountAmount);
      }
      grossRevenue += amount;

      if (!revenueByCourse[enrollment.courseId]) {
        revenueByCourse[enrollment.courseId] = {
          title: enrollment.course.title,
          revenue: 0,
        };
      }
      revenueByCourse[enrollment.courseId].revenue += amount;
    }

    // Calculate total refunds - batch process for efficiency
    let totalRefunds = 0;
    const paymentIntentIds = Array.from(
      new Set(enrollments.map(e => e.paymentIntentId).filter(Boolean) as string[])
    );

    const batchSize = 10;
    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {
      const batch = paymentIntentIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (paymentIntentId) => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge?.id;
            if (chargeId) {
              const refunds = await stripe.refunds.list({ charge: chargeId });
              for (const refund of refunds.data) {
                totalRefunds += refund.amount / 100;
              }
            }
          } catch (error) {
            // Skip if not accessible
          }
        })
      );
    }

    return {
      success: true,
      data: {
        grossRevenue,
        totalRefunds,
        netRevenue: grossRevenue - totalRefunds,
        revenueByCourse: Object.values(revenueByCourse),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get total revenue: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error calculating total revenue",
    };
  }
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStatisticsAction(): Promise<FinancialActionResult> {
  try {
    await requireAdmin();

    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE");
    const canceledSubscriptions = subscriptions.filter((s) => s.status === "CANCELED");
    const pastDueSubscriptions = subscriptions.filter((s) => s.status === "PAST_DUE");

    // Calculate churn rate (canceled / total)
    const churnRate =
      subscriptions.length > 0
        ? (canceledSubscriptions.length / subscriptions.length) * 100
        : 0;

    // Get subscription revenue from Stripe (estimate based on active subscriptions)
    // Note: Actual revenue would need to be fetched from Stripe API
    let estimatedMonthlyRevenue = 0;
    for (const sub of activeSubscriptions) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (stripeSub.items.data.length > 0) {
          estimatedMonthlyRevenue += (stripeSub.items.data[0].price.unit_amount || 0) / 100;
        }
      } catch (error) {
        // Skip if not accessible
      }
    }

    return {
      success: true,
      data: {
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        canceledSubscriptions: canceledSubscriptions.length,
        pastDueSubscriptions: pastDueSubscriptions.length,
        churnRate,
        estimatedMonthlyRevenue,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get subscription statistics: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error calculating subscription statistics",
    };
  }
}

/**
 * Get revenue trends (monthly data for last 12 months)
 * Optimized version that fetches all data in a single query
 */
export async function getRevenueTrendsAction(): Promise<FinancialActionResult> {
  try {
    await requireAdmin();

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch all enrollments for the 12-month period in one query
    const enrollments = await prisma.enrollment.findMany({
      where: {
        paymentIntentId: { not: null },
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        course: {
          select: {
            price: true,
          },
        },
        couponUsage: {
          select: {
            discountAmount: true,
          },
        },
      },
    });

    // Initialize month data structure
    const monthData: Record<string, { revenue: number; refunds: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthData[monthKey] = { revenue: 0, refunds: 0 };
    }

    // Calculate revenue by month
    for (const enrollment of enrollments) {
      const purchaseDate = new Date(enrollment.purchaseDate);
      const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, "0")}`;
      
      if (monthData[monthKey]) {
        let amount = Number(enrollment.course.price);
        if (enrollment.couponUsage) {
          amount -= Number(enrollment.couponUsage.discountAmount);
        }
        monthData[monthKey].revenue += amount;
      }
    }

    // Batch fetch refunds with concurrency limit
    const paymentIntentIds = Array.from(
      new Set(enrollments.map(e => e.paymentIntentId).filter(Boolean) as string[])
    );

    // Process refunds in batches to avoid overwhelming Stripe API
    const batchSize = 10;
    const refundsByEnrollment: Record<string, Array<{ date: Date; amount: number }>> = {};

    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {
      const batch = paymentIntentIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (paymentIntentId) => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const chargeId =
              typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : paymentIntent.latest_charge?.id;

            if (chargeId) {
              const refunds = await stripe.refunds.list({ charge: chargeId });

              if (!refundsByEnrollment[paymentIntentId]) {
                refundsByEnrollment[paymentIntentId] = [];
              }

              for (const refund of refunds.data) {
                refundsByEnrollment[paymentIntentId].push({
                  date: new Date(refund.created * 1000),
                  amount: refund.amount / 100,
                });
              }
            }
          } catch (error) {
            // Skip if payment intent not accessible
            console.error("Error fetching refunds:", error);
          }
        })
      );
    }

    // Map refunds to enrollments and calculate by month
    for (const enrollment of enrollments) {
      if (enrollment.paymentIntentId && refundsByEnrollment[enrollment.paymentIntentId]) {
        for (const refund of refundsByEnrollment[enrollment.paymentIntentId]) {
          const monthKey = `${refund.date.getFullYear()}-${String(refund.date.getMonth() + 1).padStart(2, "0")}`;
          if (monthData[monthKey]) {
            monthData[monthKey].refunds += refund.amount;
          }
        }
      }
    }

    // Convert to array format
    const months = Object.entries(monthData)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        refunds: data.refunds,
        netRevenue: data.revenue - data.refunds,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      success: true,
      data: { months },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get revenue trends: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error calculating revenue trends",
    };
  }
}

