import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { prisma } from "@/lib/prisma";
import { createEnrollmentAction } from "@/app/actions/enrollments";
import { createCohortEnrollmentAction } from "@/app/actions/cohort-enrollments";
import { trackCouponUsageAction } from "@/app/actions/coupons";
import { logServerError } from "@/lib/utils/error-logging";
import { sendPaymentSuccessWebhook } from "@/lib/webhooks/make";
// User is already created during checkout, so we don't need to create it here

/**
 * Stripe webhook endpoint
 * Handles payment success and creates enrollment
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    await logServerError({
      errorMessage: `Webhook signature verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      stackTrace: err instanceof Error ? err.stack : undefined,
      severity: "HIGH",
    });

    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    // Handle payment intent succeeded
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as any;

      // Idempotency layer 1: Stripe can send the same event twice (~1s apart). Record event.id;
      // duplicate delivery will hit unique constraint and we return 200 without processing.
      try {
        await prisma.stripeWebhookEvent.create({
          data: { eventId: event.id },
        });
      } catch (eventErr: unknown) {
        const code = (eventErr as { code?: string })?.code;
        if (code === "P2002") {
          return NextResponse.json({ received: true });
        }
        throw eventErr;
      }

      const {
        userId,
        courseId,
        cohortId,
        originalAmount,
        discountAmount,
        finalAmount,
        couponCode,
        couponId,
        type,
      } = paymentIntent.metadata;

      if (!userId || (!courseId && !cohortId)) {
        await logServerError({
          errorMessage: "Missing userId or courseId/cohortId in payment intent metadata",
          severity: "HIGH",
        });
        return NextResponse.json({ received: true });
      }

      const isCohortPayment = type === "cohort" || !!cohortId;
      const paymentType = isCohortPayment ? "cohort" : "course";
      const targetId = isCohortPayment ? cohortId : courseId;

      if (!targetId) {
        await logServerError({
          errorMessage: "Missing courseId or cohortId in payment intent metadata",
          severity: "HIGH",
        });
        return NextResponse.json({ received: true });
      }

      // Idempotency check: Check if enrollment already exists for this paymentIntentId
      // This prevents duplicate enrollments if Stripe retries the webhook
      let existingEnrollment;
      if (isCohortPayment) {
        existingEnrollment = await prisma.cohortEnrollment.findFirst({
          where: { paymentIntentId: paymentIntent.id },
          select: { id: true, orderNumber: true },
        });
      } else {
        existingEnrollment = await prisma.enrollment.findFirst({
          where: { paymentIntentId: paymentIntent.id },
          select: { id: true, orderNumber: true },
        });
      }

      let enrollmentResult;
      let enrollmentId: string;

      // If enrollment already exists, use it (idempotency)
      if (existingEnrollment) {
        enrollmentId = existingEnrollment.id;
        // Return early - enrollment already processed, no need to create or send webhook again
        return NextResponse.json({ received: true });
      }

      if (isCohortPayment) {
        // Handle cohort enrollment
        const cohort = await prisma.cohort.findUnique({
          where: { id: cohortId! },
          select: { accessDuration: true },
        });

        if (!cohort) {
          await logServerError({
            errorMessage: `Cohort not found: ${cohortId}`,
            severity: "HIGH",
          });
          return NextResponse.json({ received: true });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + cohort.accessDuration);

        enrollmentResult = await createCohortEnrollmentAction({
          userId,
          cohortId: cohortId!,
          expiresAt,
          paymentIntentId: paymentIntent.id,
        });

        if (!enrollmentResult.success || !enrollmentResult.data) {
          await logServerError({
            errorMessage: `Failed to create cohort enrollment: ${enrollmentResult.error}`,
            severity: "CRITICAL",
          });
          return NextResponse.json({ received: true });
        }

        enrollmentId = enrollmentResult.data.id;
      } else {
        // Handle course enrollment
        const course = await prisma.course.findUnique({
          where: { id: courseId! },
          select: { accessDuration: true },
        });

        if (!course) {
          await logServerError({
            errorMessage: `Course not found: ${courseId}`,
            severity: "HIGH",
          });
          return NextResponse.json({ received: true });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + course.accessDuration);

        enrollmentResult = await createEnrollmentAction({
          userId,
          courseId: courseId!,
          expiresAt,
          paymentIntentId: paymentIntent.id,
        });

        if (!enrollmentResult.success || !enrollmentResult.data) {
          await logServerError({
            errorMessage: `Failed to create enrollment: ${enrollmentResult.error}`,
            severity: "CRITICAL",
          });
          return NextResponse.json({ received: true });
        }

        enrollmentId = enrollmentResult.data.id;

        // Track coupon usage if applicable (only for courses)
        if (couponId && enrollmentResult.data) {
          console.log(`[Webhook] Tracking coupon usage: Coupon ${couponId}, Enrollment ${enrollmentResult.data.id}, Discount ${discountAmount}`);
          try {
            await trackCouponUsageAction(
              couponId,
              enrollmentResult.data.id,
              parseFloat(discountAmount || "0")
            );
            console.log("[Webhook] Coupon usage tracked successfully");
          } catch (error) {
            console.error("[Webhook] Coupon tracking failed:", error);
            // Log but don't fail enrollment
            await logServerError({
              errorMessage: `Failed to track coupon usage: ${error instanceof Error ? error.message : "Unknown error"}`,
              stackTrace: error instanceof Error ? error.stack : undefined,
              severity: "MEDIUM",
            });
          }
        } else {
          if (couponId) console.log(`[Webhook] Skipping coupon tracking. CouponId present? ${!!couponId}, Enrollment data present? ${!!enrollmentResult.data}`);
        }
      }

      // Send webhook to Make.com (awaited to ensure delivery in serverless environments)
      // Note: We only send webhook here, not from enrollment actions, to avoid duplicates
      try {
        if (!process.env.MAKE_WEBHOOK_PAYMENTS_URL) {
          await logServerError({
            errorMessage: "MAKE_WEBHOOK_PAYMENTS_URL is not set",
            severity: "MEDIUM",
            userId,
          });
        }

        // Fetch user details
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        });

        if (!user) {
          console.error("User not found for webhook:", userId);
        } else {
          const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
          const userEmail = user.email;
          const userPhone = user.phone;

          // Fetch course or cohort title
          let courseTitle: string | null = null;
          let cohortTitle: string | null = null;

          if (isCohortPayment) {
            const cohort = await prisma.cohort.findUnique({
              where: { id: cohortId! },
              select: { title: true },
            });
            cohortTitle = cohort?.title || null;
          } else {
            const course = await prisma.course.findUnique({
              where: { id: courseId! },
              select: { title: true },
            });
            courseTitle = course?.title || null;
          }

          // Get enrollment to retrieve order_number
          let orderNumber: number | null = null;

          if (isCohortPayment) {
            const cohortEnrollment = await prisma.cohortEnrollment.findUnique({
              where: { id: enrollmentId },
              select: { orderNumber: true },
            }).catch(() => null);
            orderNumber = cohortEnrollment?.orderNumber || null;
          } else {
            const enrollment = await prisma.enrollment.findUnique({
              where: { id: enrollmentId },
              select: { orderNumber: true },
            }).catch(() => null);
            orderNumber = enrollment?.orderNumber || null;
          }

          await sendPaymentSuccessWebhook({
            paymentIntentId: paymentIntent.id,
            userId,
            courseId: isCohortPayment ? undefined : courseId!,
            courseTitle: courseTitle,
            cohortId: isCohortPayment ? cohortId! : undefined,
            cohortTitle: cohortTitle,
            enrollmentId,
            orderNumber,
            amount: parseFloat(finalAmount || "0"),
            originalAmount: parseFloat(originalAmount || "0"),
            discountAmount: parseFloat(discountAmount || "0"),
            couponCode: couponCode || null,
            type: paymentType as "course" | "cohort",
            userName: userName,
            userEmail: userEmail,
            userPhone: userPhone,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        await logServerError({
          errorMessage: `Failed to send payment webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
          stackTrace: error instanceof Error ? error.stack : undefined,
          severity: "MEDIUM",
          userId,
        });
      }

      return NextResponse.json({ received: true });
    }

    // Handle other event types as needed
    return NextResponse.json({ received: true });
  } catch (error) {
    await logServerError({
      errorMessage: `Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "CRITICAL",
    });

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
