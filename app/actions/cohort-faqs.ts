"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminOrInstructor } from "@/lib/auth/require-auth";
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
 * Get all FAQs for a cohort
 */
export async function getCohortFAQsAction(cohortId: string) {
  try {
    const faqs = await prisma.cohortFAQ.findMany({
      where: { cohortId },
      orderBy: { order: "asc" },
    });

    return { success: true, data: faqs };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error while retrieving FAQs" };
  }
}

/**
 * Create a new FAQ for a cohort
 */
export async function createCohortFAQAction(
  cohortId: string,
  data: z.infer<typeof faqSchema>
): Promise<FAQActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if cohort exists and instructor has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Instructors can only manage FAQs for their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    const validatedData = faqSchema.parse(data);

    const faq = await prisma.cohortFAQ.create({
      data: {
        ...validatedData,
        cohortId,
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
      errorMessage: `Failed to create cohort FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error creating the FAQ" };
  }
}

/**
 * Update a FAQ
 */
export async function updateCohortFAQAction(
  faqId: string,
  data: Partial<z.infer<typeof faqSchema>>
): Promise<FAQActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if FAQ exists and get cohort info
    const faq = await prisma.cohortFAQ.findUnique({
      where: { id: faqId },
      include: { cohort: true },
    });

    if (!faq) {
      return {
        success: false,
        error: "FAQ introuvable",
      };
    }

    // Instructors can only manage FAQs for their own cohorts
    if (user.role === "INSTRUCTOR" && faq.cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this FAQ",
      };
    }

    const validatedData = faqSchema.partial().parse(data);

    const updatedFaq = await prisma.cohortFAQ.update({
      where: { id: faqId },
      data: validatedData,
    });

    return { success: true, data: updatedFaq };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update cohort FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error updating the FAQ" };
  }
}

/**
 * Delete a FAQ
 */
export async function deleteCohortFAQAction(faqId: string): Promise<FAQActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if FAQ exists and get cohort info
    const faq = await prisma.cohortFAQ.findUnique({
      where: { id: faqId },
      include: { cohort: true },
    });

    if (!faq) {
      return {
        success: false,
        error: "FAQ introuvable",
      };
    }

    // Instructors can only manage FAQs for their own cohorts
    if (user.role === "INSTRUCTOR" && faq.cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to delete this FAQ",
      };
    }

    await prisma.cohortFAQ.delete({
      where: { id: faqId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete cohort FAQ: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error deleting the FAQ" };
  }
}

/**
 * Reorder FAQs
 */
export async function reorderCohortFAQsAction(
  cohortId: string,
  faqIds: string[]
): Promise<FAQActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if cohort exists and instructor has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Instructors can only manage FAQs for their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    // Update order for each FAQ
    await Promise.all(
      faqIds.map((faqId, index) =>
        prisma.cohortFAQ.update({
          where: { id: faqId },
          data: { order: index },
        })
      )
    );

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder cohort FAQs: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error reordering the FAQs" };
  }
}

