"use server";

import { stripe } from "@/lib/stripe/server";
import { sendPaymentSuccessWebhook } from "@/lib/webhooks/make";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { validateCouponAction, applyCouponDiscountAction } from "@/app/actions/coupons";
import { logServerError } from "@/lib/utils/error-logging";
import { createEnrollmentAction } from "@/app/actions/enrollments";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { z } from "zod";
import type { ReceiptData } from "@/components/receipt/types";

const createPaymentIntentSchema = z.object({
  courseId: z.string().min(1),
  couponCode: z.string().optional().nullable(),
});

const createCohortPaymentIntentSchema = z.object({
  cohortId: z.string().min(1),
  couponCode: z.string().optional().nullable(),
});

export type PaymentActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a PaymentIntent for one-time purchase
 * @param userId Optional user ID to use instead of requireAuth (for checkout flow)
 */
export async function createPaymentIntentAction(
  data: z.infer<typeof createPaymentIntentSchema>,
  userId?: string
): Promise<PaymentActionResult> {
  try {
    let user;
    if (userId) {
      // Use provided userId (for checkout flow)
      user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return {
          success: false,
          error: "Utilisateur introuvable",
        };
      }
    } else {
      // Use requireAuth (for authenticated users)
      user = await requireAuth();
    }

    const validatedData = createPaymentIntentSchema.parse(data);

    // Get course
    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
      include: { category: true },
    });

    if (!course) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    if (!course.published) {
      return {
        success: false,
        error: "This course is not yet available",
      };
    }

    if (course.paymentType === "SUBSCRIPTION") {
      return {
        success: false,
        error: "Les abonnements ne sont pas encore disponibles",
      };
    }

    // Check if user already has active enrollment
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: validatedData.courseId,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (existingEnrollment) {
      return {
        success: false,
        error: "You are already enrolled in this course",
      };
    }

    let originalAmount = Number(course.price);
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let couponId: string | null = null;

    // Apply coupon if provided
    if (validatedData.couponCode) {
      const couponValidation = await validateCouponAction(
        validatedData.couponCode,
        validatedData.courseId
      );

      if (!couponValidation.success || !couponValidation.data) {
        return couponValidation;
      }

      const discountResult = await applyCouponDiscountAction(
        validatedData.couponCode,
        originalAmount,
        validatedData.courseId
      );

      if (!discountResult.success || !discountResult.data) {
        return discountResult;
      }

      discountAmount = Number(discountResult.data.discountAmount);
      finalAmount = Number(discountResult.data.finalPrice);
      couponId = couponValidation.data.id;
    }

    // Create PaymentIntent
    // Only allow card payments (disable Klarna, Affirm, etc.)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100), // Convert to cents
      currency: "cad",
      payment_method_types: ["card"], // Only allow card payments
      metadata: {
        userId: user.id,
        courseId: validatedData.courseId,
        courseTitle: course.title,
        originalAmount: originalAmount.toString(),
        discountAmount: discountAmount.toString(),
        finalAmount: finalAmount.toString(),
        couponCode: validatedData.couponCode || "",
        couponId: couponId || "",
      },
      description: `Achat: ${course.title}`,
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        originalAmount,
        discountAmount,
        finalAmount,
        couponCode: validatedData.couponCode,
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
      errorMessage: `Failed to create payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAuth()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating payment",
    };
  }
}

/**
 * Create a PaymentIntent for cohort purchase (one-time only)
 * @param userId Optional user ID to use instead of requireAuth (for checkout flow)
 */
export async function createCohortPaymentIntentAction(
  data: z.infer<typeof createCohortPaymentIntentSchema>,
  userId?: string
): Promise<PaymentActionResult> {
  try {
    let user;
    if (userId) {
      // Use provided userId (for checkout flow)
      user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return {
          success: false,
          error: "Utilisateur introuvable",
        };
      }
    } else {
      // Use requireAuth (for authenticated users)
      user = await requireAuth();
    }

    const validatedData = createCohortPaymentIntentSchema.parse(data);

    // Get cohort
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

    if (!cohort.published) {
      return {
        success: false,
        error: "This cohort is not yet available",
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

    // Check if user already has active enrollment
    const existingEnrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId: user.id,
        cohortId: validatedData.cohortId,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (existingEnrollment) {
      return {
        success: false,
        error: "You are already enrolled in this cohort",
      };
    }

    let originalAmount = Number(cohort.price);
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let couponId: string | null = null;

    // Note: Coupons for cohorts not implemented yet, but structure is ready
    // Apply coupon if provided (when coupon system supports cohorts)
    if (validatedData.couponCode) {
      // For now, return error - coupon support for cohorts can be added later
      return {
        success: false,
        error: "Les codes promo ne sont pas encore disponibles pour les cohortes",
      };
    }

    // Create PaymentIntent
    // Only allow card payments (disable Klarna, Affirm, etc.)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100), // Convert to cents
      currency: "cad",
      payment_method_types: ["card"], // Only allow card payments
      metadata: {
        userId: user.id,
        cohortId: validatedData.cohortId,
        cohortTitle: cohort.title,
        originalAmount: originalAmount.toString(),
        discountAmount: discountAmount.toString(),
        finalAmount: finalAmount.toString(),
        couponCode: validatedData.couponCode || "",
        couponId: couponId || "",
        type: "cohort", // Mark as cohort payment
      },
      description: `Achat: ${cohort.title}`,
    });

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        originalAmount,
        discountAmount,
        finalAmount,
        couponCode: validatedData.couponCode,
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
      errorMessage: `Failed to create cohort payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAuth()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating payment",
    };
  }
}

/**
 * Get payment history for current user
 */
export async function getPaymentHistoryAction(params: {
  cursor?: string;
  limit?: number;
}) {
  try {
    const user = await requireAuth();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: user.id,
        paymentIntentId: { not: null },
      },
      take: limit + 1,
      cursor,
      orderBy: { purchaseDate: "desc" },
      include: {
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

    // Fetch Stripe payment intent details and refunds
    const paymentsWithDetails = await Promise.all(
      enrollments.map(async (enrollment) => {
        let paymentIntent = null;
        let refunds: any[] = [];

        if (enrollment.paymentIntentId) {
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
        }

        return {
          enrollment,
          paymentIntent,
          refunds,
        };
      })
    );
    const hasMore = enrollments.length > limit;
    const items = hasMore ? paymentsWithDetails.slice(0, limit) : paymentsWithDetails;
    const serializedItems = items.map((item) => ({
      ...item,
      enrollment: {
        ...item.enrollment,
        course: {
          ...item.enrollment.course,
          price: Number(item.enrollment.course.price),
          appointmentHourlyRate: item.enrollment.course.appointmentHourlyRate
            ? Number(item.enrollment.course.appointmentHourlyRate)
            : null,
        },
        couponUsage: item.enrollment.couponUsage ? {
          ...item.enrollment.couponUsage,
          discountAmount: Number(item.enrollment.couponUsage.discountAmount),
          coupon: {
            ...item.enrollment.couponUsage.coupon,
            discountValue: Number(item.enrollment.couponUsage.coupon.discountValue),
          }
        } : null,
      }
    }));

    const nextCursor = hasMore && serializedItems.length > 0 ? serializedItems[serializedItems.length - 1].enrollment.id : null;

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get payment history: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Download receipt/invoice
 */
export async function downloadReceiptAction(paymentIntentId: string) {
  try {
    const user = await requireAuth();

    // Verify enrollment belongs to user
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        paymentIntentId,
      },
      include: {
        course: true,
      },
    });

    if (!enrollment) {
      return {
        success: false,
        error: "Payment not found",
      };
    }

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Generate receipt data
    const receipt = {
      paymentIntentId,
      date: enrollment.purchaseDate,
      course: {
        title: enrollment.course.title,
        price: Number(enrollment.course.price),
      },
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      customer: {
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      },
    };

    return {
      success: true,
      data: receipt,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to download receipt: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error downloading the receipt",
    };
  }
}

/**
 * Get receipt data for PDF generation (course or cohort).
 * Verifies the payment belongs to the current user.
 */
export async function getReceiptDataAction(
  paymentIntentId: string
): Promise<{ success: boolean; error?: string; data?: ReceiptData }> {
  try {
    const user = await requireAuth();

    const currency = "CAD";
    const currencyDisplay = currency;
    const formatAmount = (amount: number) =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
      }).format(amount);

    // Build query based on role
    const whereQuery: any = { paymentIntentId };
    // Only restrict to current user if not admin
    if (user.role !== "ADMIN") {
      whereQuery.userId = user.id;
    }

    // Try course enrollment first
    const enrollment = await prisma.enrollment.findFirst({
      where: whereQuery,
      include: {
        course: true,
        couponUsage: { include: { coupon: true } },
      },
    });

    if (enrollment) {
      console.log(`[getReceiptDataAction] Enrollment found: ${enrollment.id}`);
      console.log(`[getReceiptDataAction] CouponUsage:`, enrollment.couponUsage);

      let paymentIntent;
      let charge = null;
      let status: ReceiptData["status"] = "Paid";

      try {
        paymentIntent = await stripe.paymentIntents.retrieve(
          paymentIntentId,
          { expand: ["latest_charge"] }
        );
        charge =
          typeof paymentIntent.latest_charge === "object" &&
            paymentIntent.latest_charge !== null
            ? paymentIntent.latest_charge
            : null;

        if (paymentIntent.status !== "succeeded") {
          status = "Failed";
        } else if (charge && "amount_refunded" in charge && charge.amount_refunded > 0) {
          status = "Refunded";
        }
      } catch (error) {
        console.warn(`Payment intent not found in Stripe: ${paymentIntentId}. Using database records.`);
        // Fallback to database records if Stripe fails (e.g. dev env)
        const price = Number(enrollment.course.price);
        const discountVal = Number(enrollment.couponUsage?.discountAmount || 0);
        paymentIntent = {
          amount: (price - discountVal) * 100,
          currency: "cad",
          status: "succeeded",
        };
      }

      const paymentMethodDetails = charge?.payment_method_details as
        | { card?: { brand?: string; last4?: string } }
        | undefined;
      const card = paymentMethodDetails?.card;
      const paymentMethod =
        card?.brand && card?.last4
          ? `Card (${card.brand} •••• ${card.last4})`
          : "Card";

      const purchaseDate = enrollment.purchaseDate;
      const amount = paymentIntent.amount / 100;
      let discount: string | null = null;
      let discountAmount = 0;

      // Calculate discount (prioritize DB, fallback to Metadata)
      if (enrollment.couponUsage?.discountAmount != null) {
        discountAmount = Number(enrollment.couponUsage.discountAmount);
        discount = `-${formatAmount(discountAmount)}`;
      } else if (paymentIntent && paymentIntent.metadata && paymentIntent.metadata.discountAmount) {
        // Fallback to metadata if DB record is missing (e.g. webhook failure)
        const metaDiscount = parseFloat(paymentIntent.metadata.discountAmount);
        if (!isNaN(metaDiscount) && metaDiscount > 0) {
          discountAmount = metaDiscount;
          discount = `-${formatAmount(discountAmount)}`;
          console.log(`[getReceiptDataAction] Used PaymentIntent metadata for discount: ${discountAmount}`);
        }
      }

      // Calculate total (Price - Discount + Taxes)
      const originalPrice = Number(enrollment.course.price);
      // Note: Taxes are currently null (not calculated in this function) 
      // If taxes were present (tps/tvq), they should be added here. 
      // Assuming for now paymentIntent.amount matches the final charged amount? 
      // If paymentIntent.amount = 33745 ($337.45), and Original = 397, Discount = 59.55.
      // 397 - 59.55 = 337.45.
      // So Total = paymentIntent.amount / 100.
      const total = paymentIntent.amount / 100;

      const data: ReceiptData = {
        productName: enrollment.course.title,
        price: originalPrice,
        currency: currencyDisplay,
        userName:
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
        userEmail: user.email,
        orderNumber: enrollment.orderNumber ?? null,
        paymentMethod,
        dateShort: format(purchaseDate, "MM/dd/yyyy"),
        dateLong: format(purchaseDate, "MMMM d, yyyy", { locale: enCA }),
        tps: null,
        tvq: null,
        tpsNumber: null,
        tvqNumber: null,
        discount,
        total,
        status,
      };

      return { success: true, data };
    }

    // Try cohort enrollment
    const cohortEnrollment = await prisma.cohortEnrollment.findFirst({
      where: whereQuery, // Use same query logic
      include: { cohort: true },
    });

    if (cohortEnrollment) {
      let paymentIntent;
      let charge = null;
      let status: ReceiptData["status"] = "Paid";

      try {
        paymentIntent = await stripe.paymentIntents.retrieve(
          paymentIntentId,
          { expand: ["latest_charge"] }
        );
        charge =
          typeof paymentIntent.latest_charge === "object" &&
            paymentIntent.latest_charge !== null
            ? paymentIntent.latest_charge
            : null;

        if (paymentIntent.status !== "succeeded") {
          status = "Failed";
        } else if (charge && "amount_refunded" in charge && charge.amount_refunded > 0) {
          status = "Refunded";
        }
      } catch (error) {
        console.warn(`Payment intent not found in Stripe: ${paymentIntentId}. Using database records.`);
        const price = Number(cohortEnrollment.cohort.price);
        // Cohort coupons not implemented yet, so discount is 0
        const discountVal = 0;
        paymentIntent = {
          amount: (price - discountVal) * 100,
          currency: "cad",
          status: "succeeded",
        };
      }

      const paymentMethodDetails = charge?.payment_method_details as
        | { card?: { brand?: string; last4?: string } }
        | undefined;
      const card = paymentMethodDetails?.card;
      const paymentMethod =
        card?.brand && card?.last4
          ? `Card (${card.brand} •••• ${card.last4})`
          : "Card";

      const purchaseDate = cohortEnrollment.purchaseDate;
      const amount = paymentIntent.amount / 100;

      const data: ReceiptData = {
        productName: cohortEnrollment.cohort.title,
        price: amount,
        currency: currencyDisplay,
        userName:
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
        userEmail: user.email,
        orderNumber: cohortEnrollment.orderNumber ?? null,
        paymentMethod,
        dateShort: format(purchaseDate, "MM/dd/yyyy"),
        dateLong: format(purchaseDate, "MMMM d, yyyy", { locale: enCA }),
        tps: null,
        tvq: null,
        tpsNumber: null,
        tvqNumber: null,
        discount: null,
        total: amount,
        status,
      };

      return { success: true, data };
    }

    return {
      success: false,
      error: "Payment not found",
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get receipt data: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return {
      success: false,
      error: "Error retrieving receipt",
    };
  }
}

/**
 * Create enrollment from payment intent (fallback if webhook hasn't fired)
 * This ensures enrollment is created immediately after payment confirmation
 * Handles both courses and cohorts
 */
export async function createEnrollmentFromPaymentIntentAction(
  paymentIntentId: string
): Promise<PaymentActionResult> {
  try {
    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        error: "The payment did not succeed",
      };
    }

    const { userId, courseId, cohortId, type } = paymentIntent.metadata;
    const isCohort = type === "cohort" || cohortId;

    if (!userId) {
      return {
        success: false,
        error: "Incomplete payment information",
      };
    }

    if (isCohort) {
      // Handle cohort enrollment
      if (!cohortId) {
        return {
          success: false,
          error: "Incomplete payment information",
        };
      }

      // Check if enrollment already exists (webhook might have created it)
      const existingEnrollment = await prisma.cohortEnrollment.findFirst({
        where: {
          paymentIntentId: paymentIntentId,
        },
      });

      if (existingEnrollment) {
        return {
          success: true,
          data: existingEnrollment,
        };
      }

      // Get cohort to calculate expiration
      const cohort = await prisma.cohort.findUnique({
        where: { id: cohortId },
        select: { accessDuration: true },
      });

      if (!cohort) {
        return {
          success: false,
          error: "Cohort not found",
        };
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + cohort.accessDuration);

      // Create cohort enrollment
      const { createCohortEnrollmentAction } = await import("@/app/actions/cohort-enrollments");
      const enrollmentResult = await createCohortEnrollmentAction({
        userId,
        cohortId,
        expiresAt,
        paymentIntentId: paymentIntentId,
      });

      if (!enrollmentResult.success) {
        return {
          success: false,
          error: enrollmentResult.error || "Error while creating the registration",
        };
      }

      // Send webhook as fallback if webhook handler hasn't fired yet
      // This ensures webhook fires even if Stripe webhook is delayed or fails
      // Note: The webhook handler has idempotency check, so if it fires later, it won't create duplicates
      if (enrollmentResult.data && enrollmentResult.data.paymentIntentId) {
        // Fire and forget - send webhook in background
        (async () => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const metadata = paymentIntent.metadata || {};

            const originalAmount = parseFloat(metadata.originalAmount || "0");
            const discountAmount = parseFloat(metadata.discountAmount || "0");
            const finalAmount = parseFloat(metadata.finalAmount || paymentIntent.amount.toString()) / 100;
            const couponCode = metadata.couponCode || null;

            const enrollment = enrollmentResult.data;
            const userName = `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim() || enrollment.user.email;

            sendPaymentSuccessWebhook({
              paymentIntentId: paymentIntentId,
              userId: enrollment.userId,
              cohortId: enrollment.cohortId,
              cohortTitle: enrollment.cohort?.title,
              enrollmentId: enrollment.id,
              orderNumber: enrollment.orderNumber,
              amount: finalAmount || originalAmount,
              originalAmount: originalAmount || finalAmount,
              discountAmount: discountAmount,
              couponCode: couponCode,
              type: "cohort",
              userName: userName,
              userEmail: enrollment.user.email,
              userPhone: enrollment.user.phone,
              timestamp: new Date().toISOString(),
            }).catch((error) => {
              console.error("Failed to send payment webhook from cohort fallback:", error);
            });
          } catch (error) {
            console.error("Failed to send cohort fallback webhook:", error);
          }
        })();
      }

      return {
        success: true,
        data: enrollmentResult.data,
      };
    } else {
      // Handle course enrollment
      if (!courseId) {
        return {
          success: false,
          error: "Incomplete payment information",
        };
      }

      // Check if enrollment already exists (webhook might have created it)
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: {
          paymentIntentId: paymentIntentId,
        },
      });

      if (existingEnrollment) {
        return {
          success: true,
          data: existingEnrollment,
        };
      }

      // Get course to calculate expiration
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { accessDuration: true },
      });

      if (!course) {
        return {
          success: false,
          error: "Course not found",
        };
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + course.accessDuration);

      // Create enrollment (skip auth check since this is called from payment context)
      const enrollmentResult = await createEnrollmentAction({
        userId,
        courseId,
        expiresAt,
        paymentIntentId: paymentIntentId,
      }, true);

      if (!enrollmentResult.success) {
        return {
          success: false,
          error: enrollmentResult.error || "Error while creating the registration",
        };
      }

      // Send webhook as fallback if webhook handler hasn't fired yet
      // This ensures webhook fires even if Stripe webhook is delayed or fails
      // Note: The webhook handler has idempotency check, so if it fires later, it won't create duplicates
      if (enrollmentResult.data && enrollmentResult.data.paymentIntentId) {
        // Fire and forget - send webhook in background
        (async () => {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const metadata = paymentIntent.metadata || {};

            const originalAmount = parseFloat(metadata.originalAmount || "0");
            const discountAmount = parseFloat(metadata.discountAmount || "0");
            const finalAmount = parseFloat(metadata.finalAmount || paymentIntent.amount.toString()) / 100;
            const couponCode = metadata.couponCode || null;

            const enrollment = enrollmentResult.data;
            const userName = `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim() || enrollment.user.email;

            sendPaymentSuccessWebhook({
              paymentIntentId: paymentIntentId,
              userId: enrollment.userId,
              courseId: enrollment.courseId,
              courseTitle: enrollment.course.title,
              enrollmentId: enrollment.id,
              orderNumber: enrollment.orderNumber,
              amount: finalAmount || originalAmount,
              originalAmount: originalAmount || finalAmount,
              discountAmount: discountAmount,
              couponCode: couponCode,
              type: "course",
              userName: userName,
              userEmail: enrollment.user.email,
              userPhone: enrollment.user.phone,
              timestamp: new Date().toISOString(),
            }).catch((error) => {
              console.error("Failed to send payment webhook from fallback:", error);
            });
          } catch (error) {
            console.error("Failed to send fallback webhook:", error);
          }
        })();
      }

      return {
        success: true,
        data: enrollmentResult.data,
      };
    }
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to create enrollment from payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while creating the registration",
    };
  }
}

