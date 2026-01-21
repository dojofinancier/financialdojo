"use server";

import { requireAdmin } from "@/lib/auth/require-auth";
import { getErrorLogs, markErrorResolved, logError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import type { ErrorSeverity, ErrorType } from "@prisma/client";

/**
 * Get error logs (admin only)
 */
export async function getErrorLogsAction(params: {
  cursor?: string;
  limit?: number;
  resolved?: boolean;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}): Promise<PaginatedResult<any>> {
  try {
    await requireAdmin();

    return await getErrorLogs({
      cursor: params.cursor,
      limit: params.limit,
      resolved: params.resolved,
      severity: params.severity,
    });
  } catch (error) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

/**
 * Mark error as resolved (admin only)
 */
export async function resolveErrorAction(errorId: string) {
  try {
    await requireAdmin();

    await markErrorResolved(errorId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: "Error resolving the error",
    };
  }
}

/**
 * Log client-side error (public, for error boundaries and error pages)
 */
export async function logClientErrorAction(params: {
  errorMessage: string;
  stackTrace?: string;
  url?: string;
  userAgent?: string;
  severity?: ErrorSeverity;
}): Promise<{ success: boolean; errorId?: string }> {
  try {
    const errorId = await logError({
      errorType: "CLIENT",
      errorMessage: params.errorMessage,
      stackTrace: params.stackTrace,
      url: params.url,
      userAgent: params.userAgent,
      severity: params.severity || "MEDIUM",
    });

    return { success: true, errorId };
  } catch (error) {
    // Don't fail if logging fails, just return success: false
    console.error("Failed to log client error:", error);
    return { success: false };
  }
}

