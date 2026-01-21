"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfileActionResult = {
  success: boolean;
  error?: string;
};

export type PurchaseHistoryItem = {
  id: string;
  type: "course" | "cohort";
  productName: string;
  purchaseDate: Date;
  amount: number;
  expiresAt: Date;
};

/**
 * Update user profile (name, email)
 */
export async function updateProfileAction(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): Promise<ProfileActionResult> {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    // Update email in Supabase if provided
    if (data.email && data.email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: data.email,
      });

      if (emailError) {
        return {
          success: false,
          error: emailError.message,
        };
      }
    }

    // Update Prisma user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || user.email,
      },
    });

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      success: false,
      error: "An error occurred while updating the profile",
    };
  }
}

/**
 * Change password
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<ProfileActionResult> {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return {
        success: false,
        error: "The current password is incorrect",
      };
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return {
      success: false,
      error: "An error occurred while changing the password",
    };
  }
}

/**
 * Get user's purchase history (courses and cohorts)
 */
export async function getUserPurchaseHistoryAction(): Promise<{
  success: boolean;
  data?: PurchaseHistoryItem[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Get course enrollments
    const courseEnrollments = await prisma.enrollment.findMany({
      where: { userId: user.id },
      include: {
        course: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    // Get cohort enrollments
    const cohortEnrollments = await prisma.cohortEnrollment.findMany({
      where: { userId: user.id },
      include: {
        cohort: {
          select: {
            title: true,
            price: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    // Combine and format purchases
    const purchases: PurchaseHistoryItem[] = [
      ...courseEnrollments.map((enrollment) => ({
        id: enrollment.id,
        type: "course" as const,
        productName: enrollment.course.title,
        purchaseDate: enrollment.purchaseDate,
        amount: Number(enrollment.course.price),
        expiresAt: enrollment.expiresAt,
      })),
      ...cohortEnrollments.map((enrollment) => ({
        id: enrollment.id,
        type: "cohort" as const,
        productName: enrollment.cohort.title,
        purchaseDate: enrollment.purchaseDate,
        amount: Number(enrollment.cohort.price),
        expiresAt: enrollment.expiresAt,
      })),
    ].sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

    return {
      success: true,
      data: purchases,
    };
  } catch (error) {
    console.error("Get purchase history error:", error);
    return {
      success: false,
      error: "An error occurred while retrieving the purchase history",
    };
  }
}

