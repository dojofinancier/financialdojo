"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOrInstructor, requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import { unstable_cache } from "next/cache";

const componentVisibilitySchema = z.object({
  videos: z.boolean().default(true),
  quizzes: z.boolean().default(true),
  flashcards: z.boolean().default(true),
  notes: z.boolean().default(true),
  messaging: z.boolean().default(true),
  appointments: z.boolean().default(true),
  groupCoaching: z.boolean().default(true),
  messageBoard: z.boolean().default(true),
  virtualTutor: z.boolean().default(false),
});

const cohortSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional(),
  aboutText: z.string().optional().nullable(),
  features: z.array(z.object({
    id: z.string(),
    icon: z.string(),
    text: z.string(),
  })).optional().default([]),
  testimonials: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    text: z.string(),
    avatar: z.string().optional(),
  })).optional().default([]),
  heroImages: z.array(z.string()).optional().default([]),
  price: z.number().min(0, "The price must be positive"),
  maxStudents: z.number().int().positive("The maximum number of students must be positive"),
  enrollmentClosingDate: z.date(),
  accessDuration: z.number().int().positive().default(365),
  published: z.boolean().default(false),
  instructorId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(), // Link to base course
  componentVisibility: componentVisibilitySchema.optional(),
});

export type CohortActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Sync all modules from a course to a cohort
 * This automatically adds all course modules to the cohort in the same order
 */
async function syncCohortModulesFromCourse(cohortId: string, courseId: string): Promise<void> {
  try {
    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new Error(`Course with ID ${courseId} not found`);
    }

    // Get all modules from the course, ordered
    const courseModules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    // If course has no modules, that's fine - just return
    if (courseModules.length === 0) {
      console.log(`Course ${courseId} has no modules to sync`);
      return;
    }

    // Get existing cohort modules to avoid duplicates
    const existingCohortModules = await prisma.cohortModule.findMany({
      where: { cohortId },
      select: { moduleId: true },
    });
    const existingModuleIds = new Set(existingCohortModules.map((cm) => cm.moduleId));

    // Add modules that don't already exist in the cohort
    const modulesToAdd = courseModules.filter((m) => !existingModuleIds.has(m.id));

    if (modulesToAdd.length > 0) {
      // Get the max order in the cohort
      const maxOrderResult = await prisma.cohortModule.findFirst({
        where: { cohortId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const maxOrder = maxOrderResult?.order ?? -1;

      // Create cohort modules preserving the course module order
      await prisma.cohortModule.createMany({
        data: modulesToAdd.map((module, index) => ({
          cohortId,
          moduleId: module.id,
          order: maxOrder + 1 + index,
        })),
      });
      
      console.log(`Synced ${modulesToAdd.length} modules from course ${courseId} to cohort ${cohortId}`);
    } else {
      console.log(`All modules from course ${courseId} already exist in cohort ${cohortId}`);
    }
  } catch (error) {
    console.error("Error syncing cohort modules from course:", error);
    throw error; // Re-throw to be caught by the calling function
  }
}

/**
 * Create a new cohort (admin or instructor)
 */
export async function createCohortAction(
  data: z.infer<typeof cohortSchema>
): Promise<CohortActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    const validatedData = cohortSchema.parse(data);

    // If instructor, set instructorId to their own ID
    const instructorId = user.role === "INSTRUCTOR" ? user.id : validatedData.instructorId;

    const { componentVisibility, title, slug, courseId, heroImages, ...createData } = validatedData;

    // Use provided slug or generate from title
    let finalSlug: string;
    if (slug && slug.trim()) {
      // Validate and ensure uniqueness of provided slug
      const baseSlug = generateSlug(slug.trim());
      const existingSlugs = await prisma.cohort.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
      }).then(cohorts => cohorts.map(c => c.slug).filter(Boolean) as string[]);
      finalSlug = generateUniqueSlug(baseSlug, existingSlugs);
    } else {
      // Generate slug from title
      const baseSlug = generateSlug(title);
      const existingSlugs = await prisma.cohort.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
      }).then(cohorts => cohorts.map(c => c.slug).filter(Boolean) as string[]);
      finalSlug = generateUniqueSlug(baseSlug, existingSlugs);
    }

    const prismaData: any = {
      ...createData,
      title,
      slug: finalSlug,
      instructorId,
    };

    // Include courseId if provided
    if (courseId !== undefined) {
      prismaData.courseId = courseId;
    }

    // Handle heroImages - explicitly set as JSON array
    if (heroImages !== undefined) {
      prismaData.heroImages = heroImages;
    }

    if (componentVisibility !== undefined) {
      prismaData.componentVisibility = componentVisibility;
    }

    const cohort = await prisma.cohort.create({
      data: prismaData,
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // If courseId is provided, sync all modules from the course
    if (validatedData.courseId) {
      await syncCohortModulesFromCourse(cohort.id, validatedData.courseId);
    }

    // Convert Decimal to number for serialization
    const serializedCohort = {
      ...cohort,
      price: Number(cohort.price),
    };

    return { success: true, data: serializedCohort };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    // Log the actual error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Cohort create error details:", {
      errorMessage,
      errorStack,
      data: JSON.stringify(data, null, 2),
    });

    await logServerError({
      errorMessage: `Failed to create cohort: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error creating the cohort: ${errorMessage}`,
    };
  }
}

/**
 * Update a cohort (admin or instructor - instructor can only update their own cohorts)
 */
export async function updateCohortAction(
  cohortId: string,
  data: Partial<z.infer<typeof cohortSchema>>
): Promise<CohortActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if cohort exists and instructor has permission
    const existingCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!existingCohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Instructors can only update their own cohorts
    if (user.role === "INSTRUCTOR" && existingCohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    const validatedData = cohortSchema.partial().parse(data);

    // If instructor, don't allow changing instructorId
    if (user.role === "INSTRUCTOR" && validatedData.instructorId) {
      delete validatedData.instructorId;
    }

    const { componentVisibility, title, slug, courseId, heroImages, ...updateData } = validatedData;

    const prismaData: any = { ...updateData };
    
    // If courseId is being updated, include it in the update
    if (courseId !== undefined) {
      prismaData.courseId = courseId;
    }

    // Handle heroImages - explicitly set as JSON array
    if (heroImages !== undefined) {
      prismaData.heroImages = heroImages;
    }

    // Handle slug update
    if (slug !== undefined) {
      if (slug && slug.trim()) {
        // Use provided slug (validate and ensure uniqueness)
        const baseSlug = generateSlug(slug.trim());
        const existingSlugs = await prisma.cohort.findMany({
          where: { 
            slug: { not: null },
            id: { not: cohortId }
          },
          select: { slug: true },
        }).then(cohorts => cohorts.map(c => c.slug).filter(Boolean) as string[]);
        prismaData.slug = generateUniqueSlug(baseSlug, existingSlugs);
      } else {
        // Empty slug - regenerate from title
        const titleToUse = title !== undefined ? title : existingCohort.title;
        const baseSlug = generateSlug(titleToUse);
        const existingSlugs = await prisma.cohort.findMany({
          where: { 
            slug: { not: null },
            id: { not: cohortId }
          },
          select: { slug: true },
        }).then(cohorts => cohorts.map(c => c.slug).filter(Boolean) as string[]);
        prismaData.slug = generateUniqueSlug(baseSlug, existingSlugs);
      }
    } else if (title !== undefined) {
      // Title updated but slug not provided - regenerate slug from title
      const baseSlug = generateSlug(title);
      const existingSlugs = await prisma.cohort.findMany({
        where: { 
          slug: { not: null },
          id: { not: cohortId }
        },
        select: { slug: true },
      }).then(cohorts => cohorts.map(c => c.slug).filter(Boolean) as string[]);
      prismaData.slug = generateUniqueSlug(baseSlug, existingSlugs);
    }

    if (componentVisibility !== undefined) {
      prismaData.componentVisibility = componentVisibility;
    }

    const cohort = await prisma.cohort.update({
      where: { id: cohortId },
      data: prismaData,
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // If courseId was updated, sync modules from the new course
    if (courseId !== undefined && courseId !== null && courseId !== existingCohort.courseId) {
      // Remove existing modules if courseId changed
      if (existingCohort.courseId) {
        await prisma.cohortModule.deleteMany({
          where: { cohortId },
        });
      }
      // Sync modules from the new course
      await syncCohortModulesFromCourse(cohortId, courseId);
    } else if (courseId !== undefined && courseId === null && existingCohort.courseId) {
      // If courseId is being removed, optionally keep existing modules or remove them
      // For now, we'll keep them - admin can manually remove if needed
    }

    // Convert Decimal to number for serialization
    const serializedCohort = {
      ...cohort,
      price: Number(cohort.price),
    };

    return { success: true, data: serializedCohort };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    // Log the actual error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Cohort update error details:", {
      errorMessage,
      errorStack,
      cohortId,
      data: JSON.stringify(data, null, 2),
    });

    await logServerError({
      errorMessage: `Failed to update cohort: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error updating the cohort: ${errorMessage}`,
    };
  }
}

/**
 * Delete a cohort (admin or instructor - instructor can only delete their own cohorts)
 */
export async function deleteCohortAction(
  cohortId: string
): Promise<CohortActionResult> {
  try {
    const user = await requireAdminOrInstructor();

    // Check if cohort exists and instructor has permission
    const existingCohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!existingCohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Instructors can only delete their own cohorts
    if (user.role === "INSTRUCTOR" && existingCohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to delete this cohort",
      };
    }

    await prisma.cohort.delete({
      where: { id: cohortId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete cohort: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while deleting the cohort",
    };
  }
}

/**
 * Check if a string is a UUID
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get a cohort by slug or ID
 * Supports both slug-based URLs and UUID-based URLs for backward compatibility
 */
export async function getCohortBySlugAction(slug: string) {
  try {
    await requireAuth();

    // If it's a UUID, look up by ID (backward compatibility)
    // Otherwise, look up by slug
    const whereClause = isUUID(slug)
      ? { id: slug }
      : { slug: slug };

    const cohort = await prisma.cohort.findFirst({
      where: whereClause,
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        cohortModules: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
                contentItems: {
                  include: {
                    video: true,
                    quiz: true,
                  },
                },
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!cohort) {
      return { success: false, error: "Cohort not found" };
    }

    // Convert Decimal to number for serialization
    const serializedCohort = {
      ...cohort,
      price: Number(cohort.price),
      cohortModules: cohort.cohortModules?.map((cm: any) => ({
        ...cm,
        module: cm.module ? {
          ...cm.module,
          course: cm.module.course ? {
            ...cm.module.course,
          } : cm.module.course,
        } : cm.module,
      })) || [],
    };

    return { success: true, data: serializedCohort };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort by slug: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return { success: false, error: "Error while retrieving the cohort" };
  }
}

/**
 * Get a cohort by ID
 * @deprecated Use getCohortBySlugAction instead
 */
export async function getCohortAction(cohortId: string) {
  try {
    await requireAuth();

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        cohortModules: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
                contentItems: {
                  include: {
                    video: true,
                    quiz: true,
                  },
                },
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!cohort) {
      return { success: false, error: "Cohort not found" };
    }

    // Convert Decimal to number for serialization
    // Also need to serialize nested Decimal fields in cohortModules
    const serializedCohort = {
      ...cohort,
      price: Number(cohort.price),
      cohortModules: cohort.cohortModules?.map((cm: any) => ({
        ...cm,
        module: cm.module ? {
          ...cm.module,
          course: cm.module.course ? {
            ...cm.module.course,
          } : cm.module.course,
        } : cm.module,
      })) || [],
    };

    return { success: true, data: serializedCohort };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while retrieving the cohort",
    };
  }
}

/**
 * Get cohort content for learning interface (validates enrollment)
 */
/**
 * Get a published cohort by slug (public, no auth required)
 * Used for public product pages
 * Cached for 5 minutes to improve server response time
 */
export async function getPublishedCohortBySlugAction(slug: string) {
  try {
    // Use cached version for better performance
    const getCachedCohort = unstable_cache(
      async (cohortSlug: string) => {
        // If it's a UUID, look up by ID (backward compatibility)
        // Otherwise, look up by slug
        const whereClause = isUUID(cohortSlug)
          ? { id: cohortSlug, published: true }
          : { slug: cohortSlug, published: true };

        const cohort = await prisma.cohort.findFirst({
          where: whereClause,
          include: {
            instructor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            cohortModules: {
              orderBy: { order: "asc" },
              include: {
                module: {
                  include: {
                    contentItems: {
                      orderBy: { order: "asc" },
                      select: {
                        id: true,
                        contentType: true,
                        order: true,
                      },
                    },
                  },
                },
              },
            },
            faqs: {
              orderBy: { order: "asc" },
            },
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        });

        if (!cohort) {
          return null;
        }

        // Check if enrollment closing date has passed
        const now = new Date();
        const isEnrollmentOpen = cohort.enrollmentClosingDate > now;
        const spotsRemaining = cohort.maxStudents - cohort._count.enrollments;

        // Calculate total questions and flashcards from the linked course
        let totalQuestions = 0;
        let totalFlashcards = 0;

        if (cohort.courseId) {
          // Batch queries for better performance - run in parallel
          const [quizzes, questionBanks, flashcardCount] = await Promise.all([
            prisma.quiz.findMany({
              where: {
                contentItem: {
                  module: {
                    courseId: cohort.courseId,
                  },
                },
              },
              include: {
                questions: {
                  select: {
                    id: true,
                  },
                },
              },
            }),
            prisma.questionBank.findMany({
              where: {
                courseId: cohort.courseId,
              },
              include: {
                questions: {
                  select: {
                    id: true,
                  },
                },
              },
            }),
            prisma.flashcard.count({
              where: {
                courseId: cohort.courseId,
              },
            }),
          ]);

          // Count quiz questions
          totalQuestions += quizzes.reduce((acc, quiz) => acc + quiz.questions.length, 0);
          
          // Count question bank questions
          totalQuestions += questionBanks.reduce((acc, bank) => acc + bank.questions.length, 0);
          
          totalFlashcards = flashcardCount;
        }

        // Convert Decimal to number for serialization
        // Parse JSON fields properly
        const features = Array.isArray(cohort.features) 
          ? cohort.features 
          : (typeof cohort.features === 'string' ? JSON.parse(cohort.features) : []);
        const testimonials = Array.isArray(cohort.testimonials) 
          ? cohort.testimonials 
          : (typeof cohort.testimonials === 'string' ? JSON.parse(cohort.testimonials) : []);
        const heroImages = Array.isArray(cohort.heroImages) 
          ? cohort.heroImages 
          : (typeof cohort.heroImages === 'string' ? JSON.parse(cohort.heroImages) : []);

        return {
          ...cohort,
          price: cohort.price.toNumber(),
          features: features as any[],
          testimonials: testimonials as any[],
          heroImages: heroImages as string[],
          isEnrollmentOpen,
          spotsRemaining: Math.max(0, spotsRemaining),
          totalQuestions,
          totalFlashcards,
          cohortModules: cohort.cohortModules?.map((cm: any) => ({
            ...cm,
            module: cm.module ? {
              ...cm.module,
            } : cm.module,
          })) || [],
        };
      },
      ["published-cohort"],
      { revalidate: 300, tags: ["cohorts"] } // 5 minutes cache
    );

    return await getCachedCohort(slug);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get published cohort by slug: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Get cohort content by slug (for enrolled students)
 */
export async function getCohortContentBySlugAction(slug: string) {
  try {
    const user = await requireAuth();
    const { checkCohortAccessAction } = await import("@/app/actions/cohort-enrollments");

    // First find cohort by slug or ID (backward compatibility)
    const whereClause = isUUID(slug)
      ? { id: slug }
      : { slug: slug };

    const cohort = await prisma.cohort.findFirst({
      where: whereClause,
      select: { id: true },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Use the existing getCohortContentAction with the cohort ID
    return await getCohortContentAction(cohort.id);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort content by slug: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while retrieving the cohort content",
    };
  }
}

/**
 * Get cohort content by ID (for enrolled students)
 * @deprecated Use getCohortContentBySlugAction instead
 */
export async function getCohortContentAction(cohortId: string) {
  try {
    const user = await requireAuth();
    const { checkCohortAccessAction } = await import("@/app/actions/cohort-enrollments");

    // Validate access
    const accessResult = await checkCohortAccessAction(cohortId);
    if (!accessResult.hasAccess) {
      return {
        success: false,
        error: "You do not have access to this cohort",
      };
    }

    // Get cohort with modules and content
    const cohortData = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        course: {
          select: {
            id: true,
            recommendedStudyHoursMin: true,
            recommendedStudyHoursMax: true,
          },
        },
        cohortModules: {
          orderBy: { order: "asc" },
          include: {
            module: {
              include: {
                contentItems: {
                  orderBy: { order: "asc" },
                  include: {
                    video: {
                      select: {
                        id: true,
                        vimeoUrl: true,
                        duration: true,
                        transcript: true,
                      },
                    },
                    quiz: {
                      include: {
                        questions: {
                          orderBy: { order: "asc" },
                        },
                      },
                    },
                    notes: {
                      where: { type: "ADMIN" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cohortData) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    // Transform cohortModules into modules format (for compatibility with PhaseBasedLearningInterface)
    const modules = cohortData.cohortModules.map((cm) => ({
      id: cm.module.id,
      title: cm.module.title,
      shortTitle: cm.module.shortTitle,
      description: cm.module.description,
      order: cm.order,
      contentItems: cm.module.contentItems.map((item) => ({
        id: item.id,
        contentType: item.contentType,
        order: item.order,
        title: item.quiz?.title || "Contenu",
      })),
    }));

    // Convert Decimal to number for serialization
    const serializedCohort = {
      id: cohortData.id,
      title: cohortData.title,
      description: cohortData.description,
      courseId: cohortData.courseId,
      componentVisibility: cohortData.componentVisibility,
      recommendedStudyHoursMin: cohortData.course?.recommendedStudyHoursMin ?? null,
      recommendedStudyHoursMax: cohortData.course?.recommendedStudyHoursMax ?? null,
      modules,
    };

    return {
      success: true,
      data: serializedCohort,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohort content: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while loading the content",
    };
  }
}

/**
 * Get all instructors (for cohort assignment)
 */
export async function getInstructorsAction() {
  try {
    await requireAdminOrInstructor();

    const instructors = await prisma.user.findMany({
      where: {
        role: "INSTRUCTOR",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    return { success: true, data: instructors };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get instructors: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while retrieving the instructors",
      data: [],
    };
  }
}

/**
 * Get published cohorts for catalog (public, no auth required)
 * Note: Date filtering is done client-side to keep this route cacheable
 */
async function fetchPublishedCohorts(): Promise<PaginatedResult<any>> {
  try {
    // Fetch all published cohorts - date filtering happens client-side
    const cohorts = await prisma.cohort.findMany({
      where: {
        published: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        price: true,
        maxStudents: true,
        enrollmentClosingDate: true,
        accessDuration: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    // Convert Decimal to number for serialization
    const serializedCohorts = cohorts.map((cohort) => ({
      ...cohort,
      price: Number(cohort.price),
    }));

    return {
      items: serializedCohorts,
      nextCursor: null,
      hasMore: false,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get published cohorts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

// Cached version for better performance
const getCachedPublishedCohorts = unstable_cache(
  async () => {
    return fetchPublishedCohorts();
  },
  ["published-cohorts"],
  {
    revalidate: 300, // 5 minutes - cohorts don't change frequently
    tags: ["cohorts"],
  }
);

/**
 * Get published cohorts for catalog (public, no auth required)
 * Uses caching to improve performance
 */
export async function getPublishedCohortsAction(): Promise<PaginatedResult<any>> {
  return getCachedPublishedCohorts();
}

/**
 * Get all cohorts (paginated)
 */
export async function getCohortsAction(params: {
  cursor?: string;
  limit?: number;
  published?: boolean;
  instructorId?: string;
}): Promise<PaginatedResult<any>> {
  try {
    await requireAuth();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {};
    if (params.published !== undefined) {
      where.published = params.published;
    }
    if (params.instructorId) {
      where.instructorId = params.instructorId;
    }

    const cohorts = await prisma.cohort.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { createdAt: "desc" },
      include: {
        instructor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    // Convert Decimal to number for serialization
    const serializedCohorts = cohorts.map((cohort) => ({
      ...cohort,
      price: Number(cohort.price),
    }));

    const hasMore = serializedCohorts.length > limit;
    const items = hasMore ? serializedCohorts.slice(0, limit) : serializedCohorts;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get cohorts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }
}

/**
 * Add a module to a cohort
 */
export async function addModuleToCohortAction(
  cohortId: string,
  moduleId: string,
  order?: number
): Promise<CohortActionResult> {
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

    // Instructors can only modify their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    // Check if module exists
    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleRecord) {
      return {
        success: false,
        error: "Module not found",
      };
    }

    // If order not provided, get the max order + 1
    let moduleOrder = order;
    if (moduleOrder === undefined) {
      const maxOrder = await prisma.cohortModule.findFirst({
        where: { cohortId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      moduleOrder = maxOrder ? maxOrder.order + 1 : 0;
    }

    // Check if module already exists in cohort
    const existing = await prisma.cohortModule.findFirst({
      where: {
        cohortId,
        moduleId,
      },
    });

    if (existing) {
      return {
        success: false,
        error: "This module is already in the cohort",
      };
    }

    const cohortModule = await prisma.cohortModule.create({
      data: {
        cohortId,
        moduleId,
        order: moduleOrder,
      },
      include: {
        module: {
          include: {
            contentItems: {
              include: {
                video: true,
                quiz: true,
              },
            },
          },
        },
      },
    });

    return { success: true, data: cohortModule };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to add module to cohort: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while adding the module to the cohort",
    };
  }
}

/**
 * Remove a module from a cohort
 */
export async function removeModuleFromCohortAction(
  cohortId: string,
  moduleId: string
): Promise<CohortActionResult> {
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

    // Instructors can only modify their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    await prisma.cohortModule.deleteMany({
      where: {
        cohortId,
        moduleId,
      },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to remove module from cohort: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while removing the module from the cohort",
    };
  }
}

/**
 * Reorder modules in a cohort
 */
export async function reorderCohortModulesAction(
  cohortId: string,
  moduleOrders: { moduleId: string; order: number }[]
): Promise<CohortActionResult> {
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

    // Instructors can only modify their own cohorts
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    // Update each module order
    await Promise.all(
      moduleOrders.map(({ moduleId, order }) =>
        prisma.cohortModule.updateMany({
          where: {
            cohortId,
            moduleId,
          },
          data: {
            order,
          },
        })
      )
    );

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reorder cohort modules: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while reordering the modules",
    };
  }
}

/**
 * Update cohort about section (shortDescription and aboutText)
 */
export async function updateCohortAboutAction(
  cohortId: string,
  data: { shortDescription: string; aboutText: string }
): Promise<CohortActionResult> {
  try {
    await requireAdminOrInstructor();

    // Check if cohort exists and user has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    const user = await requireAdminOrInstructor();
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    await prisma.cohort.update({
      where: { id: cohortId },
      data: {
        shortDescription: data.shortDescription,
        aboutText: data.aboutText,
      },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update cohort about: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating the About section",
    };
  }
}

/**
 * Update cohort features
 */
export async function updateCohortFeaturesAction(
  cohortId: string,
  features: Array<{ id: string; icon: string; text: string }>
): Promise<CohortActionResult> {
  try {
    await requireAdminOrInstructor();

    // Check if cohort exists and user has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    const user = await requireAdminOrInstructor();
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    await prisma.cohort.update({
      where: { id: cohortId },
      data: { features },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update cohort features: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating features",
    };
  }
}

/**
 * Update cohort testimonials
 */
export async function updateCohortTestimonialsAction(
  cohortId: string,
  testimonials: Array<{ id: string; name: string; role: string; text: string; avatar?: string }>
): Promise<CohortActionResult> {
  try {
    await requireAdminOrInstructor();

    // Check if cohort exists and user has permission
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      return {
        success: false,
        error: "Cohort not found",
      };
    }

    const user = await requireAdminOrInstructor();
    if (user.role === "INSTRUCTOR" && cohort.instructorId !== user.id) {
      return {
        success: false,
        error: "You do not have permission to modify this cohort",
      };
    }

    await prisma.cohort.update({
      where: { id: cohortId },
      data: { testimonials },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update cohort testimonials: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating testimonials",
    };
  }
}
