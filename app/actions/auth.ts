"use server";

import { createClient } from "@/lib/supabase/server";
import { syncUserFromSupabase } from "@/lib/auth/user-sync";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type AuthActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Get current user info (for client components)
 */
export async function getCurrentUserInfoAction() {
  try {
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    
    if (!user) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Get current user info error:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des informations utilisateur",
    };
  }
}

/**
 * Login with email and password
 */
export async function loginAction(
  email: string,
  password: string
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data.user) {
      // Sync user to Prisma
      await syncUserFromSupabase(data.user);
      revalidatePath("/", "layout");
    }

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de la connexion",
    };
  }
}

/**
 * Logout
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // Don't redirect here - let the component handle it
}

/**
 * Request password reset
 */
export async function resetPasswordAction(
  email: string
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // IMPORTANT: use a route handler callback so PKCE cookies can be set.
      // Supabase will redirect to /auth/callback?code=... then we redirect to /reset-password/confirm.
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/reset-password/confirm`,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de la demande de réinitialisation",
    };
  }
}

/**
 * Verify password reset code/token
 */
export async function verifyPasswordResetCodeAction(
  token: string
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();

    // Exchange the code for a session (this is what Supabase expects for password reset)
    const { data, error } = await supabase.auth.exchangeCodeForSession(token);

    if (error) {
      // If exchangeCodeForSession fails, try verifyOtp as fallback (for hash-based tokens)
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      });

      if (otpError) {
        return {
          success: false,
          error: error.message || otpError.message || "Code de réinitialisation invalide ou expiré",
        };
      }
    }

    // Verify that we have a valid session after exchange
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: "Impossible d'établir une session. Veuillez réessayer.",
      };
    }

    // If we get here, the code was successfully verified and session is established
    // The session cookies are now set and will be available for subsequent requests
    return { success: true };
  } catch (error) {
    console.error("Verify password reset code error:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de la vérification du code",
    };
  }
}

/**
 * Update password (after reset)
 * Note: This requires an active recovery session from password reset
 */
export async function updatePasswordAction(
  password: string
): Promise<AuthActionResult> {
  try {
    const supabase = await createClient();

    // First check if we have a valid session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: "Session manquante. Veuillez utiliser le lien de réinitialisation envoyé par email.",
      };
    }

    // Update the password
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Update password error:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de la mise à jour du mot de passe",
    };
  }
}

