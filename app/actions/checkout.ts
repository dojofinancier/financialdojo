"use server";

import { createClient } from "@/lib/supabase/server";
import { syncUserFromSupabase } from "@/lib/auth/user-sync";
import { createPaymentIntentAction } from "@/app/actions/payments";
import { logServerError } from "@/lib/utils/error-logging";

export type CheckoutActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create user account during checkout
 */
export async function createCheckoutUserAction(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  phone?: string
): Promise<CheckoutActionResult> {
  try {
    const supabase = await createClient();

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.getUser();
    if (existingUser?.user) {
      // Get Prisma user ID from Supabase ID
      const { prisma } = await import("@/lib/prisma");
      const prismaUser = await prisma.user.findUnique({
        where: { supabaseId: existingUser.user.id },
      });
      
      if (prismaUser) {
        // Update user profile with additional information if provided
        if (firstName || lastName || phone) {
          await prisma.user.update({
            where: { id: prismaUser.id },
            data: {
              ...(firstName && { firstName }),
              ...(lastName && { lastName }),
              ...(phone && { phone }),
            },
          });
        }
        
        return {
          success: true,
          data: { userId: prismaUser.id },
        };
      }
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      // Handle specific Supabase errors
      let errorMessage = error.message;
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        // User already exists, try to sign in instead
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          return {
            success: false,
            error: "This email already exists. Please log in or use another email.",
          };
        }
        
        if (signInData.user) {
          // Sync existing user
          const syncedUser = await syncUserFromSupabase(signInData.user, firstName || null, lastName || null, phone || null);
          return {
            success: true,
            data: { userId: syncedUser.id }, // Return Prisma user ID, not Supabase ID
          };
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: "Error while creating the account",
      };
    }

    // Sync to Prisma with additional information
    const syncedUser = await syncUserFromSupabase(data.user, firstName || null, lastName || null, phone || null);

    return {
      success: true,
      data: { userId: syncedUser.id }, // Return Prisma user ID, not Supabase ID
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to create checkout user: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while creating the account",
    };
  }
}

/**
 * Create payment intent for checkout (handles both authenticated and new users)
 * Supports both courses and cohorts
 */
export async function createCheckoutPaymentIntentAction(
  courseId: string | null,
  cohortId: string | null,
  couponCode: string | null,
  email: string,
  password?: string,
  firstName?: string,
  lastName?: string,
  phone?: string
): Promise<CheckoutActionResult> {
  try {
    // Validate that exactly one of courseId or cohortId is provided
    if (!courseId && !cohortId) {
      return {
        success: false,
        error: "A course or a cohort must be specified",
      };
    }
    
    if (courseId && cohortId) {
      return {
        success: false,
        error: "Only one course or one cohort can be purchased at a time",
      };
    }

    // Check if user is already authenticated
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const currentUser = await getCurrentUser();
    
    let userId: string;
    
    if (currentUser) {
      // User is already logged in, use their ID
      userId = currentUser.id;
      
      // Update user profile with additional information if provided
      if (firstName || lastName || phone) {
        const { prisma } = await import("@/lib/prisma");
        await prisma.user.update({
          where: { id: userId },
          data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone && { phone }),
          },
        });
      }
    } else {
      // User is not logged in, create account (password required)
      if (!password) {
        return {
          success: false,
          error: "A password is required to create an account",
        };
      }
      
      const userResult = await createCheckoutUserAction(email, password, firstName, lastName, phone);
      if (!userResult.success || !userResult.data) {
        return userResult;
      }
      userId = userResult.data.userId;
    }

    // Create payment intent based on type
    if (courseId) {
      const paymentResult = await createPaymentIntentAction(
        {
          courseId,
          couponCode,
        },
        userId
      );
      return paymentResult;
    } else if (cohortId) {
      const { createCohortPaymentIntentAction } = await import("@/app/actions/payments");
      const paymentResult = await createCohortPaymentIntentAction(
        {
          cohortId,
          couponCode,
        },
        userId
      );
      return paymentResult;
    }

    return {
      success: false,
      error: "Error while preparing the payment",
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to create checkout payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while preparing the payment",
    };
  }
}


