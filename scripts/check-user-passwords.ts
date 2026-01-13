/**
 * Script to check and optionally reset passwords for users from a CSV file
 * 
 * This is useful when you need to know which password was set for users,
 * especially those with multiple enrollments.
 * 
 * Usage:
 *   npx tsx scripts/check-user-passwords.ts migration.csv
 * 
 * The script will:
 * 1. Read the CSV file
 * 2. Show which password should be set for each user (last password in CSV)
 * 3. Optionally reset passwords to match the CSV
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

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

async function checkUserPasswords(csvFilePath: string, resetPasswords: boolean = false) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

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
  const headerLower = header.map((h) => h.toLowerCase().trim());
  
  const emailIdx = headerLower.indexOf("email");
  const passwordIdx = headerLower.indexOf("password");
  const firstNameIdx = headerLower.indexOf("firstname");
  const lastNameIdx = headerLower.indexOf("lastname");

  if (emailIdx === -1) {
    throw new Error("CSV must have an 'email' column");
  }

  // Track the FIRST password for each email (case-insensitive)
  const userPasswords = new Map<string, { password: string; firstName?: string; lastName?: string; row: number }>();

  // Process CSV to find first password for each user
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const email = fields[emailIdx]?.trim().toLowerCase();
    const password = fields[passwordIdx]?.trim() || "";
    const firstName = fields[firstNameIdx]?.trim() || "";
    const lastName = fields[lastNameIdx]?.trim() || "";

    if (!email) continue;

    // Store password for this email (first one wins - only set if not already set)
    if (!userPasswords.has(email)) {
      userPasswords.set(email, {
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        row: i + 1,
      });
    }
  }

  console.log(`\n📋 Found ${userPasswords.size} unique user(s) in CSV\n`);

  // Check each user in Supabase
  const results: Array<{
    email: string;
    exists: boolean;
    csvPassword: string;
    needsPassword: boolean;
    reset: boolean;
    error?: string;
  }> = [];

  for (const [email, userData] of userPasswords.entries()) {
    console.log(`Checking: ${email}...`);

    // Find user in Supabase
    let page = 1;
    let existingUser = null;
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

      if (usersData.users.length < perPage) break;
      page++;
    }

    const csvPassword = userData.password;
    const needsPassword = !csvPassword; // Needs password if CSV has empty password
    const exists = !!existingUser;

    if (exists) {
      console.log(`  ✅ User exists in Supabase`);
      
      if (resetPasswords && csvPassword && existingUser) {
        // Reset password
        try {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password: csvPassword,
            user_metadata: {
              first_name: userData.firstName || existingUser.user_metadata?.first_name,
              last_name: userData.lastName || existingUser.user_metadata?.last_name,
            },
          });
          console.log(`  🔑 Password reset to CSV password`);
          results.push({
            email,
            exists: true,
            csvPassword,
            needsPassword: false,
            reset: true,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.log(`  ❌ Failed to reset password: ${errorMsg}`);
          results.push({
            email,
            exists: true,
            csvPassword,
            needsPassword: false,
            reset: false,
            error: errorMsg,
          });
        }
      } else if (needsPassword) {
        console.log(`  ⚠️  CSV has no password for this user`);
        results.push({
          email,
          exists: true,
          csvPassword: "",
          needsPassword: true,
          reset: false,
        });
      } else {
        console.log(`  ℹ️  CSV password: ${csvPassword} (not reset - use --reset flag)`);
        results.push({
          email,
          exists: true,
          csvPassword,
          needsPassword: false,
          reset: false,
        });
      }
    } else {
      console.log(`  ❌ User does NOT exist in Supabase`);
      results.push({
        email,
        exists: false,
        csvPassword,
        needsPassword: needsPassword,
        reset: false,
      });
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  const existingUsers = results.filter(r => r.exists);
  const missingUsers = results.filter(r => !r.exists);
  const needsPasswordUsers = results.filter(r => r.needsPassword);
  const resetPasswordsList = results.filter(r => r.reset);

  console.log(`✅ Users in Supabase: ${existingUsers.length}`);
  console.log(`❌ Users NOT in Supabase: ${missingUsers.length}`);
  console.log(`⚠️  Users needing password: ${needsPasswordUsers.length}`);
  if (resetPasswordsList.length > 0) {
    console.log(`🔑 Passwords reset: ${resetPasswordsList.length}`);
  }

  // Show password mapping
  console.log("\n🔑 Password Mapping (First password from CSV for each user):");
  console.log("-".repeat(60));
  const sortedResults = Array.from(userPasswords.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedResults.forEach(([email, data]) => {
    if (data.password) {
      console.log(`${email}: ${data.password}`);
    } else {
      console.log(`${email}: [NO PASSWORD IN CSV - Row ${data.row}]`);
    }
  });

  if (missingUsers.length > 0) {
    console.log("\n❌ Users NOT found in Supabase:");
    console.log("-".repeat(60));
    missingUsers.forEach(r => {
      console.log(`  ${r.email}`);
    });
  }

  if (needsPasswordUsers.length > 0) {
    console.log("\n⚠️  Users with NO password in CSV:");
    console.log("-".repeat(60));
    needsPasswordUsers.forEach(r => {
      console.log(`  ${r.email} (Row ${userPasswords.get(r.email)?.row})`);
    });
  }

  console.log("\n✨ Done!");
}

async function main() {
  const csvFilePath = process.argv[2];
  const resetFlag = process.argv.includes("--reset");

  if (!csvFilePath) {
    console.error("❌ Usage: npx tsx scripts/check-user-passwords.ts <path-to-csv-file> [--reset]");
    console.error("\nExample:");
    console.error("  npx tsx scripts/check-user-passwords.ts migration.csv");
    console.error("  npx tsx scripts/check-user-passwords.ts migration.csv --reset");
    process.exit(1);
  }

  const resolvedPath = path.isAbsolute(csvFilePath)
    ? csvFilePath
    : path.join(process.cwd(), csvFilePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    if (resetFlag) {
      console.log("⚠️  RESET MODE: Passwords will be updated to match CSV\n");
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise<string>((resolve) => {
        readline.question("Are you sure you want to reset passwords? (yes/no): ", resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== "yes") {
        console.log("Cancelled.");
        process.exit(0);
      }
    }

    await checkUserPasswords(resolvedPath, resetFlag);
  } catch (error) {
    console.error("\n❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
