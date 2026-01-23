/**
 * Script to reset admin user password (or create admin user if it doesn't exist)
 * Run with: npx tsx scripts/reset-admin-password.ts [new-password]
 * If no password is provided, it will use the default: "passeport"
 * 
 * This script will:
 * - Create the admin user if it doesn't exist
 * - Reset the password if the user already exists
 * - Ensure the user has ADMIN role in Prisma
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetAdminPassword() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  // Get password from command line argument or use default
  const newPassword = process.argv[2] || "passeport";
  const email = "admin@dojofinancier.com";

  // Create Supabase admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("🔐 Resetting admin password...");
    console.log(`📧 Email: ${email}`);

    // Find the admin user - search through all pages if needed
    let existingUser = null;
    let page = 0;
    const perPage = 1000;
    
    console.log("🔍 Searching for admin user...");
    while (true) {
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (listError) {
        console.error("❌ Error listing users:", listError.message);
        process.exit(1);
      }

      existingUser = existingUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        break; // Found user
      }
      
      if (existingUsers.users.length < perPage) {
        break; // Reached end of list
      }
      
      page++;
    }

    let supabaseUserId: string;

    if (!existingUser) {
      console.log("⚠️  Admin user not found. Creating new admin user...");
      
      // Try to create new user
      const { data, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true, // Auto-confirm email
      });

      if (createError) {
        // If user already exists, search more thoroughly through all pages
        if (createError.message.includes("already been registered") || 
            createError.message.includes("already exists") ||
            createError.message.includes("User already registered")) {
          console.log("ℹ️  User exists but wasn't found in initial search. Searching all pages...");
          
          // Comprehensive search through all pages
          let searchPage = 0;
          while (true) {
            const { data: allUsersData, error: searchError } = await supabase.auth.admin.listUsers({
              page: searchPage,
              perPage: 1000,
            });
            
            if (searchError) {
              console.error("❌ Error during comprehensive search:", searchError.message);
              break;
            }

            const foundUser = allUsersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (foundUser) {
              existingUser = foundUser;
              break;
            }
            
            if (allUsersData.users.length < 1000) {
              break; // Reached end
            }
            searchPage++;
          }
          
          if (existingUser) {
            supabaseUserId = existingUser.id;
            console.log("✅ Found existing user. Resetting password...");
            
            const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
              password: newPassword,
            });

            if (updateError) {
              console.error("❌ Error updating password:", updateError.message);
              process.exit(1);
            }

            console.log("✅ Password reset successfully!");
          } else {
            console.error("❌ User exists but could not be located. This may be a Supabase configuration issue.");
            console.error("   Original error:", createError.message);
            console.log("\n💡 Try running: npx tsx scripts/create-admin-user.ts");
            process.exit(1);
          }
        } else {
          console.error("❌ Error creating user in Supabase:", createError.message);
          process.exit(1);
        }
      } else if (data?.user) {
        supabaseUserId = data.user.id;
        console.log("✅ Admin user created in Supabase Auth");
      } else {
        console.error("❌ Failed to create user");
        process.exit(1);
      }
    } else {
      console.log("✅ Admin user found. Resetting password...");
      supabaseUserId = existingUser.id;

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error("❌ Error updating password:", updateError.message);
        process.exit(1);
      }

      console.log("✅ Password reset successfully!");
    }

    // Sync to Prisma and ensure ADMIN role
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
    console.log("\n✨ Admin user ready!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${newPassword}`);
    console.log(`👤 Role: ADMIN`);
    console.log(`\n🌐 You can now login at: /login`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
