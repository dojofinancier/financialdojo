/**
 * Script to give an existing user access to a specific course
 * 
 * Usage:
 *   npx tsx scripts/enroll-user.ts <email> <course-identifier>
 * 
 * Example:
 *   npx tsx scripts/enroll-user.ts john@example.com ccvm-1
 */

import { PrismaClient } from "@prisma/client";

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

/**
 * Get the next order number for enrollments
 */
async function getNextOrderNumber(): Promise<number> {
    const STARTING_ORDER_NUMBER = 5190;

    const [maxEnrollmentOrder, maxCohortOrder] = await Promise.all([
        prisma.enrollment.findFirst({
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
            where: { orderNumber: { not: null } },
        }),
        prisma.cohortEnrollment.findFirst({
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
            where: { orderNumber: { not: null } },
        }),
    ]);

    const maxOrder = Math.max(
        maxEnrollmentOrder?.orderNumber || 0,
        maxCohortOrder?.orderNumber || 0,
        STARTING_ORDER_NUMBER - 1
    );

    return maxOrder + 1;
}

async function main() {
    const email = process.argv[2];
    const courseIdentifier = process.argv[3];

    if (!email || !courseIdentifier) {
        console.error("❌ Usage: npx tsx scripts/enroll-user.ts <email> <course-identifier>");
        process.exit(1);
    }

    try {
        console.log(`\n🔍 Looking up user: ${email}...`);
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, firstName: true, lastName: true },
        });

        if (!user) {
            console.error(`❌ User not found with email: ${email}`);
            process.exit(1);
        }
        console.log(`✅ Found user: ${user.firstName || ""} ${user.lastName || ""} (${user.id})`);

        console.log(`🔍 Looking up course: ${courseIdentifier}...`);
        const course = await findCourseByIdentifier(courseIdentifier);

        if (!course) {
            console.error(`❌ Course not found with identifier: ${courseIdentifier}`);
            process.exit(1);
        }
        console.log(`✅ Found course: ${course.title} (${course.code || course.slug || course.id})`);

        // Check if enrollment already exists and is still valid
        const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
                userId: user.id,
                courseId: course.id,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (existingEnrollment) {
            console.log(`⚠️ User is already enrolled in this course. Access expires on: ${existingEnrollment.expiresAt.toISOString().split("T")[0]}`);
            process.exit(0);
        }

        // Calculate expiration date
        const accessDuration = course.accessDuration || 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + accessDuration);

        // Get next order number
        const orderNumber = await getNextOrderNumber();

        console.log(`📝 Creating enrollment (Order #${orderNumber}, Expires: ${expiresAt.toISOString().split("T")[0]})...`);

        const enrollment = await prisma.enrollment.create({
            data: {
                userId: user.id,
                courseId: course.id,
                expiresAt,
                orderNumber,
            },
        });

        console.log(`\n✨ Success! User ${email} has been enrolled in "${course.title}".`);
        console.log(`Order Number: ${enrollment.orderNumber}`);
        console.log(`Expires At: ${enrollment.expiresAt.toISOString().split("T")[0]}`);

    } catch (error) {
        console.error("\n❌ Fatal error:", error instanceof Error ? error.message : error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
