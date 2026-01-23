"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { set } from "date-fns";
import { EASTERN_TIMEZONE } from "@/lib/utils/timezone";

const availabilityRuleSchema = z.object({
  courseId: z.string().optional().nullable(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid format (HH:MM)"),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid format (HH:MM)"),
});

const availabilityExceptionSchema = z.object({
  courseId: z.string().optional().nullable(),
  startDate: z.string(), // YYYY-MM-DD format
  endDate: z.string(), // YYYY-MM-DD format
  isUnavailable: z.boolean().default(true),
});

export type AvailabilityRuleActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Save availability rules (replaces all existing rules)
 */
export async function saveAvailabilityRulesAction(
  rules: z.infer<typeof availabilityRuleSchema>[]
): Promise<AvailabilityRuleActionResult> {
  try {
    await requireAdmin();

    // Validate all rules
    const validatedRules = rules.map((rule) => availabilityRuleSchema.parse(rule));

    // Validate for overlaps within each weekday
    const validationError = validateAvailabilityRules(validatedRules);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete all existing rules
      await tx.availabilityRule.deleteMany({});

      // Insert new rules
      if (validatedRules.length > 0) {
        await tx.availabilityRule.createMany({
          data: validatedRules.map((rule) => ({
            courseId: rule.courseId || null,
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
          })),
        });
      }
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to save availability rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error saving availability rules",
    };
  }
}

/**
 * Save availability exceptions (replaces all existing exceptions)
 */
export async function saveAvailabilityExceptionsAction(
  exceptions: z.infer<typeof availabilityExceptionSchema>[]
): Promise<AvailabilityRuleActionResult> {
  try {
    await requireAdmin();

    // Validate all exceptions
    const validatedExceptions = exceptions.map((ex) =>
      availabilityExceptionSchema.parse(ex)
    );

    // Validate exceptions
    const validationError = validateAvailabilityExceptions(validatedExceptions);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete all existing exceptions
      await tx.availabilityException.deleteMany({});

      // Insert new exceptions
      if (validatedExceptions.length > 0) {
        await tx.availabilityException.createMany({
          data: validatedExceptions.map((exception) => {
            // Parse date strings and convert to UTC (midnight Eastern Time)
            const [startYear, startMonth, startDay] = exception.startDate
              .split("-")
              .map(Number);
            const [endYear, endMonth, endDay] = exception.endDate
              .split("-")
              .map(Number);

            const startReferenceDate = new Date(
              Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0, 0)
            );
            const endReferenceDate = new Date(
              Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0, 0)
            );

            const startEastern = toZonedTime(startReferenceDate, EASTERN_TIMEZONE);
            const startMidnightEastern = set(startEastern, {
              hours: 0,
              minutes: 0,
              seconds: 0,
              milliseconds: 0,
            });
            const startDate = fromZonedTime(startMidnightEastern, EASTERN_TIMEZONE);

            const endEastern = toZonedTime(endReferenceDate, EASTERN_TIMEZONE);
            const endMidnightEastern = set(endEastern, {
              hours: 0,
              minutes: 0,
              seconds: 0,
              milliseconds: 0,
            });
            const endDate = fromZonedTime(endMidnightEastern, EASTERN_TIMEZONE);

            return {
              courseId: exception.courseId || null,
              startDate,
              endDate,
              isUnavailable: exception.isUnavailable,
            };
          }),
        });
      }
    });

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to save availability exceptions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error saving availability exceptions",
    };
  }
}

/**
 * Get all availability rules
 */
export async function getAvailabilityRulesAction() {
  try {
    await requireAdmin();

    const rules = await prisma.availabilityRule.findMany({
      orderBy: [
        { weekday: "asc" },
        { startTime: "asc" },
      ],
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: rules };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get availability rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error loading rules", data: [] };
  }
}

/**
 * Get all availability exceptions
 */
export async function getAvailabilityExceptionsAction() {
  try {
    await requireAdmin();

    const exceptions = await prisma.availabilityException.findMany({
      orderBy: { startDate: "asc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return { success: true, data: exceptions };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get availability exceptions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading exceptions",
      data: [],
    };
  }
}

/**
 * Validate availability rules for overlaps
 */
function validateAvailabilityRules(
  rules: z.infer<typeof availabilityRuleSchema>[]
): string | null {
  // Group rules by weekday
  const rulesByWeekday = rules.reduce(
    (acc, rule) => {
      if (!acc[rule.weekday]) {
        acc[rule.weekday] = [];
      }
      acc[rule.weekday].push(rule);
      return acc;
    },
    {} as Record<number, z.infer<typeof availabilityRuleSchema>[]>
  );

  // Check for overlaps within each day
  for (const [weekday, dayRules] of Object.entries(rulesByWeekday)) {
    // Sort by start time
    dayRules.sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < dayRules.length - 1; i++) {
      const current = dayRules[i];
      const next = dayRules[i + 1];

      if (current.endTime > next.startTime) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        return `Overlap detected on ${dayNames[parseInt(weekday)]}: ${current.startTime}-${current.endTime} and ${next.startTime}-${next.endTime}`;
      }
    }

    // Validate time format and logic
    for (const rule of dayRules) {
      if (rule.startTime >= rule.endTime) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        return `End time must be after start time on ${dayNames[parseInt(weekday)]}: ${rule.startTime}-${rule.endTime}`;
      }
    }
  }

  return null;
}

/**
 * Validate availability exceptions
 */
function validateAvailabilityExceptions(
  exceptions: z.infer<typeof availabilityExceptionSchema>[]
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const exception of exceptions) {
    const startDate = new Date(exception.startDate);
    const endDate = new Date(exception.endDate);

    // Check if start date is before end date
    if (startDate > endDate) {
      return `Start date must be before end date: ${exception.startDate} - ${exception.endDate}`;
    }
  }

  return null;
}
