/**
 * Script to bulk enroll users from a CSV file
 * 
 * CSV Format (export from Google Sheets):
 * firstName,lastName,email,courseIdentifier,password
 * 
 * Where:
 * - firstName: User's first name
 * - lastName: User's last name  
 * - email: User's email address
 * - courseIdentifier: Course slug, code, or ID
 * - password: (Optional) Password for the user. If empty, a random password will be generated
 * 
 * Usage:
 *   npx tsx scripts/bulk-enroll-users.ts path/to/enrollments.csv
 * 
 * Example CSV:
 * firstName,lastName,email,courseIdentifier,password
 * John,Doe,john@example.com,ccvm-1,
 * Jane,Smith,jane@example.com,CCVM-2,MySecurePass123
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

// Helper to check if string is UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Generate random password
function generateRandomPassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      let field = currentField.trim().replace(/^"|"$/g, "");
      field = field.replace(/\\'/g, "'");
      field = field.replace(/\\"/g, '"');
      fields.push(field);
      currentField = "";
    } else {
      currentField += char;
    }
  }
  // Process last field
  let field = currentField.trim().replace(/^"|"$/g, "");
  field = field.replace(/\\'/g, "'");
  field = field.replace(/\\"/g, '"');
  fields.push(field);
  return fields;
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

// Create or update user in Supabase Auth
async function createOrUpdateSupabaseUser(
  supabase: any,
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<{ userId: string; wasCreated: boolean }> {
  // Try to find existing user by listing users (with pagination support)
  let existingUser = null;
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (listError) {
      console.warn(`  ⚠️  Warning: Could not list users: ${listError.message}`);
      break;
    }
    
    existingUser = usersData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) break;
    
    // If we got fewer users than perPage, we've reached the end
    if (usersData.users.length < perPage) break;
    
    page++;
  }

  if (existingUser) {
    // Update existing user
    // Always update password if provided, otherwise keep existing password
    if (password) {
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
        user_metadata: {
          first_name: firstName || existingUser.user_metadata?.first_name,
          last_name: lastName || existingUser.user_metadata?.last_name,
        },
      });
    } else {
      // Just update metadata (don't change password)
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          first_name: firstName || existingUser.user_metadata?.first_name,
          last_name: lastName || existingUser.user_metadata?.last_name,
        },
      });
    }
    return { userId: existingUser.id, wasCreated: false };
  } else {
    // Try to create new user
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
      // If user already exists error, try to find and update them
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        // Retry finding the user (might have been created between our check and now)
        const { data: retryUsersData } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const retryUser = retryUsersData?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        
        if (retryUser) {
          // Update the existing user
          // Always update password if provided
          if (password) {
            await supabase.auth.admin.updateUserById(retryUser.id, {
              password: password,
              user_metadata: {
                first_name: firstName || retryUser.user_metadata?.first_name,
                last_name: lastName || retryUser.user_metadata?.last_name,
              },
            });
          } else {
            // Just update metadata (don't change password)
            await supabase.auth.admin.updateUserById(retryUser.id, {
              user_metadata: {
                first_name: firstName || retryUser.user_metadata?.first_name,
                last_name: lastName || retryUser.user_metadata?.last_name,
              },
            });
          }
          return { userId: retryUser.id, wasCreated: false };
        }
      }
      throw new Error(`Failed to create user in Supabase: ${error.message}`);
    }

    if (!data.user) {
      throw new Error("Failed to create user - no user data returned");
    }

    return { userId: data.user.id, wasCreated: true };
  }
}

// Sync user to Prisma
async function syncUserToPrisma(
  supabaseUserId: string,
  email: string,
  firstName?: string,
  lastName?: string
) {
  return await prisma.user.upsert({
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
}

// Create enrollment
async function createEnrollment(
  userId: string,
  courseId: string,
  accessDuration: number
) {
  // Check if enrollment already exists and is still valid
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingEnrollment) {
    return { created: false, enrollment: existingEnrollment };
  }

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + accessDuration);

  const enrollment = await prisma.enrollment.create({
    data: {
      userId,
      courseId,
      expiresAt,
    },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      course: {
        select: {
          title: true,
          code: true,
        },
      },
    },
  });

  return { created: true, enrollment };
}

interface EnrollmentRow {
  firstName: string;
  lastName: string;
  email: string;
  courseIdentifier: string;
  password: string;
}

interface ProcessResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; email: string; error: string }>;
  passwords: Array<{ email: string; password: string }>;
  userPasswords: Map<string, string>; // Track final password for each user
}

async function processBulkEnrollment(csvFilePath: string): Promise<ProcessResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY"
    );
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read CSV file
  const csvContent = readFileSync(csvFilePath, "utf-8");
  const lines = csvContent.split("\n").filter((line) => line.trim());
  
  if (lines.length < 2) {
    throw new Error("CSV file must contain at least a header row and one data row");
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const expectedColumns = ["firstName", "lastName", "email", "courseIdentifier", "password"];
  const headerLower = header.map((h) => h.toLowerCase().trim());

  // Validate header
  const hasRequiredColumns = expectedColumns.every((col) =>
    headerLower.includes(col.toLowerCase())
  );

  if (!hasRequiredColumns) {
    throw new Error(
      `CSV header must contain: ${expectedColumns.join(", ")}. Found: ${header.join(", ")}`
    );
  }

  // Get column indices
  const firstNameIdx = headerLower.indexOf("firstname");
  const lastNameIdx = headerLower.indexOf("lastname");
  const emailIdx = headerLower.indexOf("email");
  const courseIdx = headerLower.indexOf("courseidentifier");
  const passwordIdx = headerLower.indexOf("password");

  const result: ProcessResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    passwords: [],
    userPasswords: new Map<string, string>(), // Track final password for each user
  };

  // Track processed emails to detect multiple enrollments for same user
  const processedEmails = new Map<string, number>();

  console.log(`\n📋 Processing ${lines.length - 1} enrollment(s)...\n`);

  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const rowNumber = i + 1;

    try {
      const firstName = fields[firstNameIdx]?.trim() || "";
      const lastName = fields[lastNameIdx]?.trim() || "";
      const email = fields[emailIdx]?.trim();
      const courseIdentifier = fields[courseIdx]?.trim();
      const password = fields[passwordIdx]?.trim() || "";

      // Validate required fields
      if (!email) {
        result.errors.push({
          row: rowNumber,
          email: email || "N/A",
          error: "Email is required",
        });
        result.failed++;
        continue;
      }

      if (!courseIdentifier) {
        result.errors.push({
          row: rowNumber,
          email,
          error: "Course identifier is required",
        });
        result.failed++;
        continue;
      }

      // Generate password if not provided
      const finalPassword = password || generateRandomPassword();
      
      // Track the password for this user (will be overwritten if multiple rows)
      // This ensures we track the LAST password set for each user
      result.userPasswords.set(email.toLowerCase(), finalPassword);
      
      if (!password) {
        result.passwords.push({ email, password: finalPassword });
      }

      // Track if this is a repeat enrollment for the same user
      const enrollmentCount = (processedEmails.get(email) || 0) + 1;
      processedEmails.set(email, enrollmentCount);
      const isMultipleEnrollment = enrollmentCount > 1;

      console.log(`\n[${i}/${lines.length - 1}] Processing: ${email}${isMultipleEnrollment ? ` (enrollment #${enrollmentCount} for this user)` : ""}`);

      // Find course
      console.log(`  🔍 Looking up course: ${courseIdentifier}`);
      const course = await findCourseByIdentifier(courseIdentifier);
      if (!course) {
        result.errors.push({
          row: rowNumber,
          email,
          error: `Course not found: ${courseIdentifier}`,
        });
        result.failed++;
        console.log(`  ❌ Course not found`);
        continue;
      }
      console.log(`  ✅ Found course: ${course.title} (${course.code || course.slug || course.id})`);

      // Create or update user in Supabase
      if (isMultipleEnrollment) {
        console.log(`  🔐 User already exists, updating if needed...`);
      } else {
        console.log(`  🔐 Creating/updating user in Supabase...`);
      }
      const { userId: supabaseUserId, wasCreated } = await createOrUpdateSupabaseUser(
        supabase,
        email,
        finalPassword,
        firstName || undefined,
        lastName || undefined
      );
      if (isMultipleEnrollment) {
        console.log(`  ✅ User account updated (existing user)`);
      } else {
        console.log(`  ✅ User ${wasCreated ? "created" : "updated"} in Supabase`);
      }

      // Sync to Prisma
      if (!isMultipleEnrollment) {
        console.log(`  🔄 Syncing to Prisma...`);
      }
      const prismaUser = await syncUserToPrisma(
        supabaseUserId,
        email,
        firstName || undefined,
        lastName || undefined
      );
      if (!isMultipleEnrollment) {
        console.log(`  ✅ User synced to Prisma (ID: ${prismaUser.id})`);
      }

      // Create enrollment
      console.log(`  📝 Creating enrollment for course: ${course.title}...`);
      const enrollmentResult = await createEnrollment(
        prismaUser.id,
        course.id,
        course.accessDuration || 365 // Default to 365 days if not set
      );

      if (enrollmentResult.created) {
        console.log(`  ✅ Enrollment created (expires: ${enrollmentResult.enrollment.expiresAt.toISOString().split("T")[0]})`);
        result.success++;
      } else {
        console.log(`  ⚠️  Enrollment already exists for this course and is still valid`);
        result.skipped++;
      }
    } catch (error) {
      const email = fields[emailIdx]?.trim() || "N/A";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      result.errors.push({
        row: rowNumber,
        email,
        error: errorMessage,
      });
      result.failed++;
      console.log(`  ❌ Error: ${errorMessage}`);
    }
  }

  return result;
}

async function main() {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    console.error("❌ Usage: npx tsx scripts/bulk-enroll-users.ts <path-to-csv-file>");
    console.error("\nExample:");
    console.error("  npx tsx scripts/bulk-enroll-users.ts enrollments.csv");
    process.exit(1);
  }

  // Resolve file path
  const resolvedPath = path.isAbsolute(csvFilePath)
    ? csvFilePath
    : path.join(process.cwd(), csvFilePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    const result = await processBulkEnrollment(resolvedPath);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${result.success}`);
    console.log(`⚠️  Skipped (already enrolled): ${result.skipped}`);
    console.log(`❌ Failed: ${result.failed}`);

    // Show all user passwords (final password set for each user)
    if (result.userPasswords.size > 0) {
      console.log("\n🔑 User Passwords (Final password for each user):");
      console.log("-".repeat(60));
      const sortedPasswords = Array.from(result.userPasswords.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
      );
      sortedPasswords.forEach(([email, password]) => {
        console.log(`${email}: ${password}`);
      });
    }
    
    // Also show which passwords were auto-generated (for reference)
    if (result.passwords.length > 0) {
      console.log("\n📝 Note: Some passwords were auto-generated (shown above)");
    }

    if (result.errors.length > 0) {
      console.log("\n❌ Errors:");
      console.log("-".repeat(60));
      result.errors.forEach(({ row, email, error }) => {
        console.log(`Row ${row} (${email}): ${error}`);
      });
    }

    console.log("\n✨ Done!");
  } catch (error) {
    console.error("\n❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
