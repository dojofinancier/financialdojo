/**
 * Script to create an admin user
 * Run with: npx tsx scripts/create-admin-user.ts
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createAdminUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const email = "admin@dojofinancier.com";
  const password = "passeport";

  // Create Supabase admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("🔐 Creating admin user in Supabase Auth...");

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find((u) => u.email === email);

    let supabaseUserId: string;

    if (existingUser) {
      console.log("✅ User already exists in Supabase Auth");
      supabaseUserId = existingUser.id;

      // Update password if needed
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
      });
      console.log("✅ Password updated");
    } else {
      // Create new user
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (error) {
        console.error("❌ Error creating user in Supabase:", error.message);
        process.exit(1);
      }

      if (!data.user) {
        console.error("❌ Failed to create user");
        process.exit(1);
      }

      supabaseUserId = data.user.id;
      console.log("✅ User created in Supabase Auth");
    }

    // Sync to Prisma and set as ADMIN
    console.log("🔄 Syncing to Prisma database...");

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

    console.log("✅ User synced to Prisma with ADMIN role");
    console.log("\n✨ Admin user created successfully!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Role: ADMIN`);
    console.log(`\n🌐 You can now login at: /login`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();

