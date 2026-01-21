"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { getEasternNow, toEasternTime } from "@/lib/utils/timezone";

const couponSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive("The discount value must be positive"),
  applicableCourses: z.array(z.string()).optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.date(),
  validUntil: z.date(),
  active: z.boolean().default(true),
});

export type CouponActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a coupon (admin only)
 */
export async function createCouponAction(
  data: z.infer<typeof couponSchema>
): Promise<CouponActionResult> {
  try {
    await requireAdmin();

    const validatedData = couponSchema.parse(data);

    // Check if code already exists
    const existing = await prisma.coupon.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return {
        success: false,
        error: "A coupon with this code already exists",
      };
    }

    const { applicableCourses, ...rest } = validatedData;
    const coupon = await prisma.coupon.create({
      data: {
        ...rest,
        // Prisma JSON fields should be undefined (omit) rather than null
        ...(applicableCourses ? { applicableCourses } : {}),
      },
    });

    // Convert Decimal to number for Client Components
    return { 
      success: true, 
      data: {
        ...coupon,
        discountValue: Number(coupon.discountValue),
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create coupon: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while creating the coupon",
    };
  }
}

/**
 * Validate a coupon code
 */
export async function validateCouponAction(
  code: string,
  courseId?: string
): Promise<CouponActionResult> {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      return {
        success: false,
        error: "Code de coupon invalide",
      };
    }

    // Check if active
    if (!coupon.active) {
      return {
        success: false,
        error: "Ce coupon n'est plus actif",
      };
    }

    // Check validity dates (using Eastern Time)
    const now = getEasternNow();
    const easternNow = toEasternTime(now);
    const easternValidFrom = toEasternTime(coupon.validFrom);
    const easternValidUntil = toEasternTime(coupon.validUntil);
    
    if (easternNow < easternValidFrom) {
      return {
        success: false,
        error: "This coupon is not yet valid",
      };
    }

    if (easternNow > easternValidUntil) {
      return {
        success: false,
        error: "This coupon has expired",
      };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return {
        success: false,
        error: "Ce coupon a atteint sa limite d'utilisation",
      };
    }

    // Check applicable courses
    if (courseId && coupon.applicableCourses) {
      const applicableCourses = coupon.applicableCourses as string[];
      if (!applicableCourses.includes(courseId)) {
        return {
          success: false,
          error: "This coupon is not applicable to this course",
        };
      }
    }

    return {
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to validate coupon: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error validating coupon",
    };
  }
}

/**
 * Apply coupon discount to a price
 */
export async function applyCouponDiscountAction(
  code: string,
  originalPrice: number,
  courseId?: string
): Promise<CouponActionResult> {
  try {
    const validation = await validateCouponAction(code, courseId);

    if (!validation.success || !validation.data) {
      return validation;
    }

    const coupon = validation.data;
    let discountAmount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = (originalPrice * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      success: true,
      data: {
        originalPrice,
        discountAmount,
        finalPrice,
        coupon: coupon,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to apply coupon discount: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error applying the coupon",
    };
  }
}

/**
 * Track coupon usage
 */
export async function trackCouponUsageAction(
  couponId: string,
  enrollmentId: string,
  discountAmount: number
): Promise<CouponActionResult> {
  try {
    // Check if already used for this enrollment
    const existing = await prisma.couponUsage.findUnique({
      where: { enrollmentId },
    });

    if (existing) {
      return {
        success: false,
        error: "This coupon has already been used for this registration",
      };
    }

    // Create usage record and increment used count
    await prisma.$transaction([
      prisma.couponUsage.create({
        data: {
          couponId,
          enrollmentId,
          discountAmount,
        },
      }),
      prisma.coupon.update({
        where: { id: couponId },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to track coupon usage: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error tracking coupon usage",
    };
  }
}

/**
 * Get all coupons (admin only)
 */
export async function getCouponsAction(params: {
  cursor?: string;
  limit?: number;
  active?: boolean;
}): Promise<PaginatedResult<any>> {
  try {
    await requireAdmin();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where = {
      active: params.active,
    };

    const coupons = await prisma.coupon.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            couponUsage: true,
          },
        },
      },
    });

    const hasMore = coupons.length > limit;
    const items = hasMore ? coupons.slice(0, limit) : coupons;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Convert Decimal to number for Client Components
    const serializedItems = items.map((coupon) => ({
      ...coupon,
      discountValue: Number(coupon.discountValue),
    }));

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get coupons: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Update coupon (admin only)
 */
export async function updateCouponAction(
  couponId: string,
  data: Partial<z.infer<typeof couponSchema>>
): Promise<CouponActionResult> {
  try {
    await requireAdmin();

    const validatedData = couponSchema.partial().parse(data);
    const { applicableCourses, ...rest } = validatedData;

    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...rest,
        // JSON field: avoid null (use undefined/omit)
        ...(applicableCourses ? { applicableCourses } : {}),
      },
    });

    // Convert Decimal to number for Client Components
    return { 
      success: true, 
      data: {
        ...coupon,
        discountValue: Number(coupon.discountValue),
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update coupon: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error updating the coupon",
    };
  }
}

/**
 * Delete coupon (admin only)
 */
export async function deleteCouponAction(
  couponId: string
): Promise<CouponActionResult> {
  try {
    await requireAdmin();

    await prisma.coupon.delete({
      where: { id: couponId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete coupon: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the coupon",
    };
  }
}

/**
 * Get coupon usage statistics (admin only)
 */
export async function getCouponUsageStatsAction(couponId: string) {
  try {
    await requireAdmin();

    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        couponUsage: {
          include: {
            enrollment: {
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
            },
          },
          orderBy: {
            usedAt: "desc",
          },
        },
      },
    });

    if (!coupon) {
      return {
        success: false,
        error: "Coupon introuvable",
      };
    }

    const totalDiscount = coupon.couponUsage.reduce(
      (sum, usage) => sum + Number(usage.discountAmount),
      0
    );

    // Convert Decimal to number for Client Components
    return {
      success: true,
      data: {
        coupon: {
          ...coupon,
          discountValue: Number(coupon.discountValue),
        },
        totalUsage: coupon.couponUsage.length,
        totalDiscount,
        averageDiscount: coupon.couponUsage.length > 0 
          ? totalDiscount / coupon.couponUsage.length 
          : 0,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get coupon usage stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error retrieving statistics",
    };
  }
}

