import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import type { User } from "@prisma/client";

export type AccessValidationResult = {
  hasAccess: boolean;
  reason?: string;
  expiresAt?: Date;
  enrollmentId?: string;
  subscriptionId?: string;
};

// Cache contentItem → courseId mapping (rarely changes)
const getCachedContentItemCourseId = unstable_cache(
  async (contentItemId: string) => {
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        module: {
          select: { courseId: true },
        },
      },
    });
    return contentItem?.module?.courseId || null;
  },
  ["content-item-course-mapping"],
  { revalidate: 3600, tags: ["content-items"] } // 1 hour cache
);

// Cache course published status and payment type (changes infrequently)
const getCachedCourseInfo = unstable_cache(
  async (courseId: string) => {
    return await prisma.course.findUnique({
      where: { id: courseId },
      select: { published: true, paymentType: true, subscriptionId: true },
    });
  },
  ["course-info"],
  { revalidate: 300, tags: ["courses"] } // 5 minutes cache
);

/**
 * Validates if a user has access to a course
 * Checks: enrollment expiration, subscription status, course published status, user suspension
 * Also checks cohort enrollment if user is enrolled in a cohort linked to this course
 * Uses cached course metadata for performance (enrollment/subscription status is NOT cached)
 */
export async function validateCourseAccess(
  userId: string,
  courseId: string
): Promise<AccessValidationResult> {
  try {
    // Fetch user suspension status and course info in parallel
    const [user, course] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { suspendedAt: true },
      }),
      getCachedCourseInfo(courseId), // Use cached course metadata
    ]);

    if (user?.suspendedAt) {
      return {
        hasAccess: false,
        reason: "Your account has been suspended",
      };
    }

    if (!course) {
      return {
        hasAccess: false,
        reason: "Course not found",
      };
    }

    if (!course.published) {
      return {
        hasAccess: false,
        reason: "This course is not yet published",
      };
    }

    // Check cohort enrollment first (cohorts can grant access to base course content)
    const cohortEnrollment = await prisma.cohortEnrollment.findFirst({
      where: {
        userId,
        cohort: {
          courseId: courseId, // Cohort linked to this course
        },
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: { expiresAt: "desc" },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (cohortEnrollment) {
      return {
        hasAccess: true,
        expiresAt: cohortEnrollment.expiresAt,
        enrollmentId: cohortEnrollment.id,
      };
    }

    // Check enrollment for one-time purchases (NOT cached - real-time check)
    if (course.paymentType === "ONE_TIME") {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId,
          courseId,
          expiresAt: {
            gte: new Date(), // Not expired
          },
        },
        orderBy: { expiresAt: "desc" },
      });

      if (!enrollment) {
        return {
          hasAccess: false,
          reason: "You are not enrolled in this course or your access has expired",
        };
      }

      return {
        hasAccess: true,
        expiresAt: enrollment.expiresAt,
        enrollmentId: enrollment.id,
      };
    }

    // Check subscription for subscription-based courses (NOT cached - real-time check)
    if (course.paymentType === "SUBSCRIPTION" && course.subscriptionId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          stripeSubscriptionId: course.subscriptionId,
          currentPeriodEnd: {
            gte: new Date(), // Not expired
          },
        },
      });

      if (!subscription) {
        return {
          hasAccess: false,
          reason: "Your subscription is not active or has expired",
        };
      }

      return {
        hasAccess: true,
        expiresAt: subscription.currentPeriodEnd,
        subscriptionId: subscription.id,
      };
    }

    return {
      hasAccess: false,
      reason: "Payment type not supported",
    };
  } catch (error) {
    console.error("Error validating course access:", error);
    return {
      hasAccess: false,
      reason: "Error verifying access",
    };
  }
}

/**
 * Validates if a user has access to a content item
 * Requires access to the parent course
 * Uses cached contentItem → course mapping for performance
 */
export async function validateContentAccess(
  userId: string,
  contentItemId: string
): Promise<AccessValidationResult> {
  try {
    // Use cached mapping for better performance
    const courseId = await getCachedContentItemCourseId(contentItemId);

    if (!courseId) {
      return {
        hasAccess: false,
        reason: "Contenu introuvable",
      };
    }

    // Validate course access
    return await validateCourseAccess(userId, courseId);
  } catch (error) {
    console.error("Error validating content access:", error);
    return {
      hasAccess: false,
      reason: "Error verifying access",
    };
  }
}

