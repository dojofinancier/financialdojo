"use server";

import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/utils/error-logging";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/server-env";

/**
 * Create admin user (one-time setup)
 * This should only be called once during initial setup
 */
export async function createAdminUserAction() {
  try {
    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseSecretKey();

    const email = "admin@dojofinancier.com";
    const password = "passeport";

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find((u) => u.email === email);

    let supabaseUserId: string;

    if (existingUser) {
      // Update password
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
      });
      supabaseUserId = existingUser.id;
    } else {
      // Create new user
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        return {
          success: false,
          error: `Failed to create user in Supabase: ${error.message}`,
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: "Failed to create user",
        };
      }

      supabaseUserId = data.user.id;
    }

    // Sync to Prisma and set as ADMIN
    const prismaUser = await prisma.user.upsert({
      where: { supabaseId: supabaseUserId },
      update: {
        role: "ADMIN",
        email: email,
      },
      create: {
        supabaseId: supabaseUserId,
        email: email,
        role: "ADMIN",
        firstName: "Admin",
      },
    });

    return {
      success: true,
      data: {
        email,
        role: prismaUser.role,
        id: prismaUser.id,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to create admin user: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

