"use server";

import { requireAdmin } from "@/lib/auth/require-auth";
import {
  getEnrollmentStatisticsAction,
  getUserEngagementAction,
} from "@/app/actions/analytics";
import {
  getTotalRevenueAction,
  getRevenueByPeriodAction,
  getSubscriptionStatisticsAction,
  getRevenueTrendsAction,
} from "@/app/actions/financials";
import {
  computeCourseAggregates,
  toCompletionRates,
  toCourseMetrics,
} from "@/lib/admin/course-aggregates";

export type AdminOverviewResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Single consolidated data load for the admin overview dashboard.
 *
 * Why this exists: the overview previously fired ~8 separate server-action
 * POSTs on mount. On Netlify each POST is its own function invocation, so a
 * cold load spun up many heavy (~82MB) instances at once, causing contention
 * that pushed several requests past the 10s gateway timeout (502s). Running
 * everything inside ONE invocation (one auth check, queries in parallel) makes
 * the overview behave like the dedicated single-page routes that already work.
 *
 * All work here is DB-only — Stripe round-trips are intentionally skipped so the
 * dashboard stays fast. The dedicated /financials page loads Stripe-accurate
 * refunds/revenue separately.
 */
export async function getAdminOverviewAction(
  year: number,
  month?: number
): Promise<AdminOverviewResult> {
  try {
    // Authenticate once for the whole payload (instead of once per sub-action).
    await requireAdmin();

    const fastOpts = { includeStripeRefunds: false as const };

    // Course aggregates power both completion rates and course metrics — compute
    // them once instead of letting each action re-run the same grouped queries.
    const [
      aggregates,
      enrollmentResult,
      engagementResult,
      totalResult,
      periodResult,
      subscriptionResult,
      trendsResult,
    ] = await Promise.all([
      computeCourseAggregates(),
      getEnrollmentStatisticsAction(),
      getUserEngagementAction(),
      getTotalRevenueAction(fastOpts),
      getRevenueByPeriodAction(year, month, fastOpts),
      getSubscriptionStatisticsAction({ includeStripeRevenue: false }),
      getRevenueTrendsAction({ includeStripeRefunds: false }),
    ]);

    return {
      success: true,
      data: {
        enrollmentStats: enrollmentResult.success ? enrollmentResult.data : null,
        completionRates: toCompletionRates(aggregates),
        userEngagement: engagementResult.success ? engagementResult.data : null,
        courseMetrics: toCourseMetrics(aggregates),
        totalRevenue: totalResult.success ? totalResult.data : null,
        periodRevenue: periodResult.success ? periodResult.data : null,
        subscriptionStats: subscriptionResult.success ? subscriptionResult.data : null,
        revenueTrends: trendsResult.success ? trendsResult.data : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to load overview data",
    };
  }
}

/**
 * Period-only refresh used when the year/month filter changes. Keeps the
 * year/month re-fetch to a single lightweight invocation.
 */
export async function getAdminOverviewPeriodAction(
  year: number,
  month?: number
): Promise<AdminOverviewResult> {
  try {
    await requireAdmin();

    const periodResult = await getRevenueByPeriodAction(year, month, {
      includeStripeRefunds: false,
    });

    return {
      success: periodResult.success,
      data: { periodRevenue: periodResult.success ? periodResult.data : null },
      error: periodResult.success ? undefined : periodResult.error,
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to load overview data",
    };
  }
}
