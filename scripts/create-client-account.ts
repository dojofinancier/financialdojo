/**
 * Script to create an individual client account
 * 
 * Usage:
 *   npx tsx scripts/create-client-account.ts
 * 
 * The script will prompt you for:
 *   - Email
 *   - Password
 *   - First Name (optional)
 *   - Last Name (optional)
 *   - Course to enroll in (optional)
 * 
 * Or you can pass arguments:
 *   npx tsx scripts/create-client-account.ts <email> <password> [firstName] [lastName] [courseIdentifier]
 * 
 * Examples:
 *   npx tsx scripts/create-client-account.ts
 *   npx tsx scripts/create-client-account.ts john@example.com MyPassword123
 *   npx tsx scripts/create-client-account.ts john@example.com MyPassword123 John Doe ccvm-1
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

// Helper to check if string is UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Find course by slug, code, or ID
async function findCourseByIdentifier(identifier: string) {
  // Try by ID first (if it's a UUID)
  if (isUUID(identifier)) {
    const course = await prisma.course.findUnique({
      where: { id: identifier },
      select: { id: true, title: true, accessDuration: true, code: true, slug: true },
    });
    if (course) return course;
  }

  // Try by slug
  const courseBySlug = await prisma.course.findUnique({
    where: { slug: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  if (courseBySlug) return courseBySlug;

  // Try by code
  const courseByCode = await prisma.course.findUnique({
    where: { code: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  if (courseByCode) return courseByCode;

  return null;
}

// Prompt for user input
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createClientAccount() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  // Create Supabase admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get user input from command line arguments or prompt
    let email: string;
    let password: string;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let courseIdentifier: string | undefined;

    if (process.argv.length >= 3) {
      // Use command line arguments
      email = process.argv[2];
      password = process.argv[3] || "";
      firstName = process.argv[4] || undefined;
      lastName = process.argv[5] || undefined;
      courseIdentifier = process.argv[6] || undefined;
    } else {
      // Prompt for input
      email = await prompt("📧 Email: ");
      if (!email) {
        console.error("❌ Email is required");
        process.exit(1);
      }

      password = await prompt("🔑 Password: ");
      if (!password) {
        console.error("❌ Password is required");
        process.exit(1);
      }

      firstName = (await prompt("👤 First Name (optional): ")) || undefined;
      lastName = (await prompt("👤 Last Name (optional): ")) || undefined;
      courseIdentifier = (await prompt("📚 Course to enroll in (slug, code, or ID - optional): ")) || undefined;
    }

    console.log("\n🔐 Creating client account...");

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let supabaseUserId: string;
    let wasCreated: boolean;

    if (existingUser) {
      console.log("⚠️  User already exists in Supabase Auth");
      supabaseUserId = existingUser.id;
      wasCreated = false;

      // Update password and metadata
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
        user_metadata: {
          first_name: firstName || existingUser.user_metadata?.first_name,
          last_name: lastName || existingUser.user_metadata?.last_name,
        },
      });
      console.log("✅ User updated in Supabase Auth");
    } else {
      // Create new user
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
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
      wasCreated = true;
      console.log("✅ User created in Supabase Auth");
    }

    // Sync to Prisma
    console.log("🔄 Syncing to Prisma database...");
    const prismaUser = await prisma.user.upsert({
      where: { supabaseId: supabaseUserId },
      update: {
        email: email,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      },
      create: {
        supabaseId: supabaseUserId,
        email: email,
        role: "STUDENT",
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });

    console.log("✅ User synced to Prisma with STUDENT role");

    // Optionally enroll in course
    if (courseIdentifier) {
      console.log(`\n📚 Enrolling in course: ${courseIdentifier}...`);
      const course = await findCourseByIdentifier(courseIdentifier);

      if (!course) {
        console.error(`❌ Course not found: ${courseIdentifier}`);
      } else {
        console.log(`✅ Found course: ${course.title} (${course.code || course.slug || course.id})`);

        // Check if enrollment already exists
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: {
            userId: prismaUser.id,
            courseId: course.id,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        if (existingEnrollment) {
          console.log("⚠️  User is already enrolled in this course");
        } else {
          // Create enrollment
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (course.accessDuration || 365));

          await prisma.enrollment.create({
            data: {
              userId: prismaUser.id,
              courseId: course.id,
              expiresAt,
            },
          });

          console.log(`✅ User enrolled in course: ${course.title}`);
        }
      }
    }

    console.log("\n✨ Client account created successfully!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Role: STUDENT`);
    if (firstName || lastName) {
      console.log(`👤 Name: ${firstName || ""} ${lastName || ""}`.trim());
    }
    console.log(`\n🌐 User can now login at: /login`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createClientAccount();
