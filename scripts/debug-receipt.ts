
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import dotenv from "dotenv";
import path from "path";

// Load env vars
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-01-27.acacia",
});

async function main() {
    console.log("Fetching latest enrollment...");
    const enrollment = await prisma.enrollment.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
            couponUsage: { include: { coupon: true } },
            course: true,
            user: true,
        },
    });

    if (!enrollment) {
        console.log("No enrollments found.");
        return;
    }

    console.log("Latest Enrollment ID:", enrollment.id);
    console.log("User:", enrollment.user.email);
    console.log("Course:", enrollment.course.title);
    console.log("Purchase Date:", enrollment.purchaseDate);
    console.log("PaymentIntentId:", enrollment.paymentIntentId);
    console.log("CouponUsage:", JSON.stringify(enrollment.couponUsage, null, 2));

    if (enrollment.paymentIntentId) {
        try {
            console.log("Fetching PaymentIntent from Stripe...");
            const pi = await stripe.paymentIntents.retrieve(enrollment.paymentIntentId);
            console.log("PaymentIntent Metadata:", JSON.stringify(pi.metadata, null, 2));
            console.log("PaymentIntent Amount:", pi.amount);
        } catch (e) {
            console.error("Error fetching PaymentIntent:", e);
        }
    }

    // Check if coupon exists
    const couponId = "a3652a3f-f4c1-4c65-bc98-a39f13b46458"; // From previous run output
    console.log(`Checking if coupon ${couponId} exists...`);
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    console.log("Coupon found:", coupon ? "YES" : "NO");
    if (coupon) console.log("Coupon Code:", coupon.code);

    // Check recent ErrorLogs
    console.log("Checking recent ErrorLogs...");
    const errors = await prisma.errorLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, errorMessage: true, stackTrace: true },
    });

    if (errors.length === 0) {
        console.log("No recent errors found.");
    } else {
        errors.forEach(e => {
            console.log(`[${e.createdAt.toISOString()}] ${e.errorMessage}`);
        });
    }

    // Try manually tracking usage to see if it works or fails
    if (!enrollment.couponUsage && couponId) {
        console.log("Attempting to manually track coupon usage...");
        try {
            // Only way to import server action in script is if it doesn't use headers() or cookies()
            // We'll use prisma directly to simulate what trackCouponUsageAction does
            console.log(`Simulating trackCouponUsageAction for Coupon ${couponId} and Enrollment ${enrollment.id}`);

            const existing = await prisma.couponUsage.findUnique({
                where: { enrollmentId: enrollment.id },
            });

            if (existing) {
                console.log("Usage ALREADY exists (found via prisma check)");
            } else {
                console.log("Creating CouponUsage record...");
                await prisma.couponUsage.create({
                    data: {
                        couponId: couponId,
                        enrollmentId: enrollment.id,
                        discountAmount: 59.55, // Hardcoded from metadata
                    },
                });
                console.log("CouponUsage created successfully!");
            }
        } catch (err) {
            console.error("Manual tracking failed:", err);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
