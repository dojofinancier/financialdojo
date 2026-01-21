"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";

const faqSchema = z.object({
  question: z.string().min(1, "La question est requise"),
  answer: z.string().min(1, "Answer is required"),
  order: z.number().int().default(0),
});

export type FAQActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all FAQs for a course
 */
export async function getCourseFAQsAction(courseId: string) {
  try {
    const faqs = await prisma.courseFAQ.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
    });

    return { success: true, data: faqs };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error while retrieving FAQs" };
  }
}

/**
 * Create a new FAQ for a course
 */
export async function createCourseFAQAction(
  courseId: string,
  data: z.infer<typeof faqSchema>
): Promise<FAQActionResult> {
  try {
    await requireAdmin();

    const validatedData = faqSchema.parse(data);

    const faq = await prisma.courseFAQ.create({
      data: {
        ...validatedData,
        courseId,
      },
    });

    return { success: true, data: faq };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create course FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error creating the FAQ" };
  }
}

/**
 * Update a FAQ
 */
export async function updateCourseFAQAction(
  faqId: string,
  data: Partial<z.infer<typeof faqSchema>>
): Promise<FAQActionResult> {
  try {
    await requireAdmin();

    const validatedData = faqSchema.partial().parse(data);

    const faq = await prisma.courseFAQ.update({
      where: { id: faqId },
      data: validatedData,
    });

    return { success: true, data: faq };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update course FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error updating the FAQ" };
  }
}

/**
 * Delete a FAQ
 */
export async function deleteCourseFAQAction(faqId: string): Promise<FAQActionResult> {
  try {
    await requireAdmin();

    await prisma.courseFAQ.delete({
      where: { id: faqId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete course FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error deleting the FAQ" };
  }
}

/**
 * Reorder FAQs
 */
export async function reorderCourseFAQsAction(
  faqIds: string[]
): Promise<FAQActionResult> {
  try {
    await requireAdmin();

    // Update order for each FAQ
    await Promise.all(
      faqIds.map((faqId, index) =>
        prisma.courseFAQ.update({
          where: { id: faqId },
          data: { order: index },
        })
      )
    );

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder course FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error reordering the FAQs" };
  }
}

