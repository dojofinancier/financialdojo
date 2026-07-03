/**
 * Give an existing user access to a specific course (creates enrollment only).
 * Does not create users or touch Supabase — use only for users that already exist in the app.
 *
 * Usage:
 *   npx tsx scripts/enroll-existing-user.ts <email> <courseIdentifier> [durationDays]
 *
 * Examples:
 *   npx tsx scripts/enroll-existing-user.ts user@example.com ccvm-1
 *   npx tsx scripts/enroll-existing-user.ts user@example.com CCVM-2 180
 *
 * - email: User's email (must exist in the database)
 * - courseIdentifier: Course slug, code, or ID
 * - durationDays: Optional. Access duration in days. Defaults to course's accessDuration or 365.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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

  const bySlug = await prisma.course.findUnique({
    where: { slug: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  if (bySlug) return bySlug;

  const byCode = await prisma.course.findUnique({
    where: { code: identifier },
    select: { id: true, title: true, accessDuration: true, code: true, slug: true },
  });
  return byCode;
}

async function enrollExistingUser() {
  const email = process.argv[2];
  const courseIdentifier = process.argv[3];
  const durationDaysArg = process.argv[4];

  if (!email || !courseIdentifier) {
    console.error("Usage: npx tsx scripts/enroll-existing-user.ts <email> <courseIdentifier> [durationDays]");
    console.error("Example: npx tsx scripts/enroll-existing-user.ts user@example.com ccvm-1");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const course = await findCourseByIdentifier(courseIdentifier);
    if (!course) {
      console.error(`Course not found: ${courseIdentifier}`);
      process.exit(1);
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingEnrollment) {
      console.log(
        `User is already enrolled in "${course.title}" (expires ${existingEnrollment.expiresAt.toISOString().split("T")[0]})`
      );
      process.exit(0);
    }

    const durationDays = durationDaysArg
      ? parseInt(durationDaysArg, 10)
      : (course.accessDuration ?? 365);
    if (isNaN(durationDays) || durationDays < 1) {
      console.error("durationDays must be a positive number");
      process.exit(1);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // order_number is allocated atomically by the DB via DEFAULT
    // nextval('enrollment_order_seq'). Do NOT pass orderNumber here.
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        expiresAt,
      },
    });

    console.log(`Enrollment created: ${user.email} → ${course.title}`);
    console.log(`Expires: ${expiresAt.toISOString().split("T")[0]} (${durationDays} days)`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enrollExistingUser();
