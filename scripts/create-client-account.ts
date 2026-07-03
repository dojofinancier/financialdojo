/**
 * Create a student account in Supabase Auth and sync to Prisma.
 * Optionally enroll the user in a course.
 *
 * Usage:
 *   npx tsx scripts/create-client-account.ts
 *
 * Interactive prompts for email, password, name, and optional course.
 *
 * Or pass arguments:
 *   npx tsx scripts/create-client-account.ts <email> <password> [firstName] [lastName] [courseIdentifier]
 *
 * Examples:
 *   npx tsx scripts/create-client-account.ts
 *   npx tsx scripts/create-client-account.ts john@example.com MyPassword123
 *   npx tsx scripts/create-client-account.ts john@example.com MyPassword123 John Doe ccvm-1
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as readline from "readline";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/server-env";

const prisma = new PrismaClient();

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function findCourseByIdentifier(identifier: string) {
  if (isUUID(identifier)) {
    const course = await prisma.course.findUnique({
      where: { id: identifier },
      select: { id: true, title: true, accessDuration: true, code: true, slug: true },
    });
    if (course) return course;
  }

  const courseBySlug = await prisma.course.findUnique({
    where: { slug: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  if (courseBySlug) return courseBySlug;

  const courseByCode = await prisma.course.findUnique({
    where: { code: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  return courseByCode;
}

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
  let supabaseUrl: string;
  let supabaseSecretKey: string;

  try {
    supabaseUrl = getSupabaseUrl();
    supabaseSecretKey = getSupabaseSecretKey();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Missing Supabase environment variables."
    );
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    let email: string;
    let password: string;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let courseIdentifier: string | undefined;

    if (process.argv.length >= 3) {
      email = process.argv[2];
      password = process.argv[3] || "";
      firstName = process.argv[4] || undefined;
      lastName = process.argv[5] || undefined;
      courseIdentifier = process.argv[6] || undefined;
    } else {
      email = await prompt("Email: ");
      if (!email) {
        console.error("Email is required.");
        process.exit(1);
      }

      password = await prompt("Password: ");
      if (!password) {
        console.error("Password is required.");
        process.exit(1);
      }

      firstName = (await prompt("First name (optional): ")) || undefined;
      lastName = (await prompt("Last name (optional): ")) || undefined;
      courseIdentifier =
        (await prompt("Course to enroll in (slug, code, or ID — optional): ")) || undefined;
    }

    if (!email || !password) {
      console.error("Email and password are required.");
      process.exit(1);
    }

    console.log("\nCreating client account...");

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let supabaseUserId: string;

    if (existingUser) {
      console.log("User already exists in Supabase Auth; updating password and metadata.");
      supabaseUserId = existingUser.id;

      await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          first_name: firstName || existingUser.user_metadata?.first_name,
          last_name: lastName || existingUser.user_metadata?.last_name,
        },
      });
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (error) {
        console.error("Error creating user in Supabase:", error.message);
        process.exit(1);
      }

      if (!data.user) {
        console.error("Failed to create user in Supabase.");
        process.exit(1);
      }

      supabaseUserId = data.user.id;
      console.log("User created in Supabase Auth.");
    }

    console.log("Syncing to Prisma...");
    const prismaUser = await prisma.user.upsert({
      where: { supabaseId: supabaseUserId },
      update: {
        email,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      },
      create: {
        supabaseId: supabaseUserId,
        email,
        role: "STUDENT",
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });

    console.log("User synced to Prisma with STUDENT role.");

    if (courseIdentifier) {
      console.log(`\nEnrolling in course: ${courseIdentifier}...`);
      const course = await findCourseByIdentifier(courseIdentifier);

      if (!course) {
        console.error(`Course not found: ${courseIdentifier}`);
      } else {
        console.log(`Found course: ${course.title} (${course.code || course.slug || course.id})`);

        const existingEnrollment = await prisma.enrollment.findFirst({
          where: {
            userId: prismaUser.id,
            courseId: course.id,
            expiresAt: { gt: new Date() },
          },
        });

        if (existingEnrollment) {
          console.log("User is already enrolled in this course.");
        } else {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (course.accessDuration || 365));

          await prisma.enrollment.create({
            data: {
              userId: prismaUser.id,
              courseId: course.id,
              expiresAt,
            },
          });

          console.log(`User enrolled in course: ${course.title}`);
          console.log(`Access expires: ${expiresAt.toISOString().split("T")[0]}`);
        }
      }
    }

    console.log("\nClient account ready.");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("Role: STUDENT");
    if (firstName || lastName) {
      console.log(`Name: ${[firstName, lastName].filter(Boolean).join(" ")}`);
    }
    console.log("\nUser can sign in at: /login");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createClientAccount();
