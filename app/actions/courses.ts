"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import type { PaginatedResult } from "@/lib/utils/pagination";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import { revalidatePath, unstable_cache } from "next/cache";

const componentVisibilitySchema = z.object({
  videos: z.boolean().default(true),
  quizzes: z.boolean().default(true),
  flashcards: z.boolean().default(true),
  notes: z.boolean().default(true),
  messaging: z.boolean().default(true),
  appointments: z.boolean().default(true),
  virtualTutor: z.boolean().default(false),
});

const courseSchema = z.object({
  code: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  price: z.number().min(0, "The price must be positive"),
  accessDuration: z.number().int().positive().default(365),
  paymentType: z.enum(["ONE_TIME", "SUBSCRIPTION"]),
  subscriptionId: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Category is required"),
  published: z.boolean().default(false),
  componentVisibility: componentVisibilitySchema.optional(),
  appointmentHourlyRate: z.number().min(0).optional().nullable(),
  recommendedStudyHoursMin: z.number().int().min(1).max(40).optional().nullable(),
  recommendedStudyHoursMax: z.number().int().min(1).max(40).optional().nullable(),
  displayOrder: z.number().int().min(0).optional().nullable(),
  orientationVideoUrl: z.string().optional().nullable().refine(
    (val) => !val || val === "" || z.string().url().safeParse(val).success,
    { message: "The URL must be a valid URL" }
  ).transform((val) => val === "" ? null : val),
  orientationText: z.string().optional().nullable(),
  heroImages: z.array(z.string()).optional().default([]),
});

export type CourseActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Create a new course (admin only)
 */
export async function createCourseAction(
  data: z.infer<typeof courseSchema>
): Promise<CourseActionResult> {
  try {
    const admin = await requireAdmin();

    const validatedData = courseSchema.parse(data);

    // Separate categoryId and componentVisibility from other fields
    const { categoryId, componentVisibility, heroImages, ...createData } = validatedData;
    
    const prismaData: any = { ...createData };
    
    // Handle heroImages - explicitly set as JSON array
    if (heroImages !== undefined) {
      prismaData.heroImages = heroImages;
    }
    
    // Generate slug from code if code exists
    if (createData.code) {
      const baseSlug = generateSlug(createData.code);
      // Check for existing slugs
      const existingSlugs = await prisma.course.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
      }).then(courses => courses.map(c => c.slug).filter(Boolean) as string[]);
      prismaData.slug = generateUniqueSlug(baseSlug, existingSlugs);
    }
    
    // Handle categoryId using the relation syntax
    if (categoryId) {
      prismaData.category = {
        connect: { id: categoryId },
      };
    }
    
    // Handle componentVisibility as JSON
    if (componentVisibility !== undefined) {
      prismaData.componentVisibility = componentVisibility;
    }

    const course = await prisma.course.create({
      data: prismaData,
      include: {
        category: true,
      },
    });

    return { success: true, data: course };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create course: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating the course",
    };
  }
}

/**
 * Update a course (admin only)
 */
export async function updateCourseAction(
  courseId: string,
  data: Partial<z.infer<typeof courseSchema>>
): Promise<CourseActionResult> {
  try {
    const admin = await requireAdmin();

    const validatedData = courseSchema.partial().parse(data);

    console.log("Updating course with data:", { courseId, validatedData });

    // Separate categoryId from other fields and handle it as a relation
    const { categoryId, code, appointmentHourlyRate, orientationVideoUrl, orientationText, heroImages, displayOrder, ...updateData } = validatedData;
    
    const prismaData: any = { ...updateData };
    
    // Handle heroImages - explicitly set as JSON array
    if (heroImages !== undefined) {
      prismaData.heroImages = heroImages;
    }
    
    // Regenerate slug if code is being updated
    if (code !== undefined && code !== null) {
      prismaData.code = code; // Include code in the update
      const baseSlug = generateSlug(code);
      // Check for existing slugs (excluding current course)
      const existingSlugs = await prisma.course.findMany({
        where: { 
          slug: { not: null },
          id: { not: courseId }
        },
        select: { slug: true },
      }).then(courses => courses.map(c => c.slug).filter(Boolean) as string[]);
      prismaData.slug = generateUniqueSlug(baseSlug, existingSlugs);
    }
    
    // Handle appointmentHourlyRate - explicitly set null if provided (even if null)
    if (appointmentHourlyRate !== undefined) {
      prismaData.appointmentHourlyRate = appointmentHourlyRate;
    }
    
    // Handle orientationVideoUrl - explicitly set null if provided (even if null)
    if (orientationVideoUrl !== undefined) {
      prismaData.orientationVideoUrl = orientationVideoUrl;
    }
    
    // Handle orientationText - explicitly set null if provided (even if null)
    if (orientationText !== undefined) {
      prismaData.orientationText = orientationText;
    }
    
    // Handle displayOrder - explicitly set null if provided (even if null)
    if (displayOrder !== undefined) {
      prismaData.displayOrder = displayOrder;
    }
    
    // Handle categoryId using the relation syntax
    if (categoryId !== undefined) {
      prismaData.category = {
        connect: { id: categoryId },
      };
    }

    const course = await prisma.course.update({
      where: { id: courseId },
      data: prismaData,
      include: {
        category: true,
      },
    });

    // Revalidate relevant paths
    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    revalidatePath("/dashboard/admin");
    revalidatePath(`/learn/${courseId}`);

    // Convert Decimal fields to numbers for client components
    const serializedCourse = {
      ...course,
      price: course.price.toNumber(),
      appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
      recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? null,
      recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? null,
    };

    return { success: true, data: serializedCourse };
  } catch (error) {
    console.error("Update course error:", error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    await logServerError({
      errorMessage: `Failed to update course: ${errorMessage}`,
      stackTrace: errorStack,
      userId: (await requireAdmin()).id,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error updating the course: ${errorMessage}`,
    };
  }
}

/**
 * Delete a course (admin only)
 */
export async function deleteCourseAction(
  courseId: string
): Promise<CourseActionResult> {
  try {
    await requireAdmin();

    await prisma.course.delete({
      where: { id: courseId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete course: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the course",
    };
  }
}

/**
 * Get all courses with pagination (admin only)
 */
export async function getCoursesAction(params: {
  cursor?: string;
  limit?: number;
  categoryId?: string;
  published?: boolean;
}) {
  try {
    await requireAdmin();

    const limit = params.limit || 20;
    const cursor = params.cursor ? { id: params.cursor } : undefined;

    const where: any = {};
    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params.published !== undefined) {
      where.published = params.published;
    }

    const courses = await prisma.course.findMany({
      where,
      take: limit + 1,
      cursor,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        _count: {
          select: {
            enrollments: true,
            modules: true,
          },
        },
      },
    });

    const hasMore = courses.length > limit;
    const items = hasMore ? courses.slice(0, limit) : courses;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Convert Decimal fields to numbers for client components
    const serializedItems = items.map((course) => ({
      ...course,
      price: course.price.toNumber(),
      appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
    }));

    return {
      items: serializedItems,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get courses: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get a single course by slug or ID (supports both for backward compatibility)
 */
export async function getCourseBySlugOrIdAction(slugOrId: string) {
  try {
    // If it's a UUID, look up by ID (backward compatibility)
    // Otherwise, look up by slug
    const whereClause = isUUID(slugOrId)
      ? { id: slugOrId }
      : { slug: slugOrId };

    const course = await prisma.course.findFirst({
      where: whereClause,
      include: {
        category: true,
        modules: {
          orderBy: { order: "asc" },
          include: {
            contentItems: {
              orderBy: { order: "asc" },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    // Convert Decimal fields to numbers for client components
    // Use explicit conversion to avoid passing Decimal objects
    return {
      ...course,
      price: course.price.toNumber(),
      appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
      recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? null,
      recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? null,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Get a single course by ID
 * @deprecated Use getCourseBySlugOrIdAction instead
 */
export async function getCourseAction(courseId: string) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        modules: {
          orderBy: { order: "asc" },
          include: {
            contentItems: {
              orderBy: { order: "asc" },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    // Convert Decimal fields to numbers for client components
    // Use explicit conversion to avoid passing Decimal objects
    return {
      ...course,
      price: course.price.toNumber(),
      appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
      recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? null,
      recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? null,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Internal function to fetch published courses (used for caching)
 */
async function fetchPublishedCourses(params: {
  search?: string;
  orderBy?: "createdAt" | "title" | "price";
  orderDirection?: "asc" | "desc";
}): Promise<PaginatedResult<any>> {
  const where: any = {
    published: true,
  };

  // Search by title, description, or code
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
      { code: { contains: params.search, mode: "insensitive" } },
    ];
  }

  // Order by displayOrder first (ascending, lower numbers first), then by the specified field
  // If no displayOrder is set, it will be null and those courses will appear after ordered ones
  const orderBy: any[] = [
    { displayOrder: "asc" }, // Primary sort: displayOrder ascending (nulls last by default in PostgreSQL)
    { createdAt: "desc" }, // Secondary sort: newest first for courses without displayOrder
  ];
  
  // If a specific orderBy is requested, use it as secondary sort instead of createdAt
  if (params.orderBy && params.orderBy !== "createdAt") {
    const orderField = params.orderBy;
    const orderDir = params.orderDirection || "desc";
    orderBy[1] = { [orderField]: orderDir };
  }

  const courses = await prisma.course.findMany({
    where,
    orderBy,
    select: {
      id: true,
      code: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      published: true,
      displayOrder: true,
      paymentType: true,
      appointmentHourlyRate: true,
      category: true,
      createdAt: true,
      _count: {
        select: {
          enrollments: true,
          modules: true,
        },
      },
    },
  });

  // Convert Decimal fields to numbers for client components
  const serializedCourses = courses.map((course) => ({
    ...course,
    price: course.price.toNumber(),
    appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
  }));

  return {
    items: serializedCourses,
    nextCursor: null,
    hasMore: false,
  };
}

// Cached version for non-search queries (search queries are not cached)
const getCachedPublishedCourses = unstable_cache(
  async (params: {
    orderBy?: "createdAt" | "title" | "price";
    orderDirection?: "asc" | "desc";
  }) => {
    return fetchPublishedCourses(params);
  },
  ["published-courses"],
  {
    revalidate: 300, // 5 minutes - courses don't change frequently
    tags: ["courses"],
  }
);

/**
 * Get published courses for catalog (public, no auth required)
 * Uses caching for non-search queries to improve performance
 */
export async function getPublishedCoursesAction(params: {
  search?: string;
  orderBy?: "createdAt" | "title" | "price";
  orderDirection?: "asc" | "desc";
}): Promise<PaginatedResult<any>> {
  try {
    // Don't cache search queries - they're dynamic
    if (params.search) {
      return fetchPublishedCourses(params);
    }

    // Cache non-search queries
    return getCachedPublishedCourses({
      orderBy: params.orderBy,
      orderDirection: params.orderDirection,
    });
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get published courses: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Check if a string is a UUID
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get published course by slug or ID (public, no auth required)
 * Supports both slug-based URLs and UUID-based URLs for backward compatibility
 * Cached for 5 minutes to improve server response time
 */
export async function getPublishedCourseBySlugAction(slug: string) {
  try {
    // Use cached version for better performance
    const getCachedCourse = unstable_cache(
      async (courseSlug: string) => {
        // If it's a UUID, look up by ID (backward compatibility)
        // Otherwise, look up by slug
        const whereClause = isUUID(courseSlug)
          ? { id: courseSlug, published: true }
          : { slug: courseSlug, published: true };

        const course = await prisma.course.findFirst({
          where: whereClause,
          include: {
            category: true,
            modules: {
              orderBy: { order: "asc" },
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
            faqs: {
              orderBy: { order: "asc" },
            },
            questionBanks: {
              include: {
                questions: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            flashcards: {
              select: {
                id: true,
              },
            },
            _count: {
              select: {
                enrollments: true,
                modules: true,
              },
            },
          },
        });

        if (!course) {
          return null;
        }

        // Batch queries for better performance - run in parallel
        const [quizzes, learningActivities] = await Promise.all([
          prisma.quiz.findMany({
            where: {
              courseId: course.id,
            },
            include: {
              questions: {
                select: {
                  id: true,
                },
              },
            },
          }),
          prisma.learningActivity.findMany({
            where: {
              courseId: course.id,
            },
            select: {
              id: true,
            },
          }),
        ]);
        
        const totalQuizQuestions = quizzes.reduce((acc, quiz) => acc + quiz.questions.length, 0);
        const totalLearningActivities = learningActivities.length;

        // Calculate total question bank questions
        const totalQuestionBankQuestions = course.questionBanks.reduce(
          (acc, qb) => acc + qb.questions.length,
          0
        );

        // Convert Decimal fields to numbers for client components
        return {
          ...course,
          price: course.price.toNumber(),
          appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
          _count: {
            ...course._count,
            flashcards: course.flashcards.length,
          },
          totalQuizQuestions,
          totalQuestionBankQuestions,
          totalLearningActivities,
        };
      },
      ["published-course"],
      { revalidate: 300, tags: ["courses"] } // 5 minutes cache
    );

    return await getCachedCourse(slug);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get published course by slug: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Get published course by ID (public, no auth required)
 * @deprecated Use getPublishedCourseBySlugAction instead
 */
export async function getPublishedCourseAction(courseId: string) {
  try {
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        published: true,
      },
      include: {
        category: true,
        modules: {
          orderBy: { order: "asc" },
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
        _count: {
          select: {
            enrollments: true,
            modules: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    // Convert Decimal fields to numbers for client components
    return {
      ...course,
      price: course.price.toNumber(),
      appointmentHourlyRate: course.appointmentHourlyRate?.toNumber() ?? null,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get published course: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return null;
  }
}

/**
 * Get course content for enrolled student (with access check)
 */
export async function getCourseContentAction(courseId: string) {
  try {
    const user = await requireAuth();
    const { validateCourseAccess } = await import("@/lib/utils/access-validation");

    // Validate access
    const accessResult = await validateCourseAccess(user.id, courseId);
    if (!accessResult.hasAccess) {
      return {
        success: false,
        error: accessResult.reason || "Access denied",
      };
    }

    // Get course with full content
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        componentVisibility: true,
        category: true,
        recommendedStudyHoursMin: true,
        recommendedStudyHoursMax: true,
        orientationVideoUrl: true,
        orientationText: true,
        modules: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            shortTitle: true,
            description: true,
            order: true,
            contentItems: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                contentType: true,
                order: true,
                video: {
                  select: {
                    id: true,
                    vimeoUrl: true,
                    duration: true,
                  },
                },
                quiz: {
                  select: {
                    id: true,
                    title: true,
                    passingScore: true,
                    timeLimit: true,
                    questions: {
                      orderBy: { order: "asc" },
                      select: {
                        id: true,
                        order: true,
                        type: true,
                        question: true,
                        options: true,
                        correctAnswer: true,
                      },
                    },
                  },
                },
                notes: {
                  where: { type: "ADMIN" },
                  select: {
                    id: true,
                    content: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    // Add computed title field to content items based on their type
    const courseWithTitles = {
      ...course,
      recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? 6,
      recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? 10,
      orientationVideoUrl: course.orientationVideoUrl ?? null,
      orientationText: course.orientationText ?? null,
      modules: course.modules.map((module) => ({
        ...module,
        contentItems: module.contentItems.map((item) => ({
          ...item,
          title: item.contentType === "QUIZ" && item.quiz
            ? item.quiz.title
            : item.contentType === "VIDEO"
            ? `Video ${item.order}`
            : item.contentType === "NOTE" && item.notes && item.notes.length > 0
            ? `Note ${item.order}`
            : item.contentType === "FLASHCARD"
            ? `Flashcard ${item.order}`
            : `Contenu ${item.order}`,
        })),
      })),
    };

    return {
      success: true,
      data: courseWithTitles,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("getCourseContentAction error:", {
      courseId,
      errorMessage,
      errorStack,
    });

    await logServerError({
      errorMessage: `Failed to get course content: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error while loading the content",
    };
  }
}

/**
 * Get course content for admin preview (bypasses enrollment check)
 */
export async function getCourseContentForAdminPreviewAction(courseId: string) {
  try {
    await requireAdmin();

    // Get course with full content (no enrollment check for admins)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        modules: {
          orderBy: { order: "asc" },
          include: {
            contentItems: {
              orderBy: { order: "asc" },
              include: {
                video: true,
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
    });

    if (!course) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    // Add computed title field to content items based on their type
    const courseWithTitles = {
      ...course,
      modules: course.modules.map((module) => ({
        ...module,
        contentItems: module.contentItems.map((item) => ({
          ...item,
          title:
            item.contentType === "QUIZ" && item.quiz
              ? item.quiz.title
              : item.contentType === "VIDEO"
              ? `Video ${item.order}`
              : item.contentType === "NOTE" && item.notes && item.notes.length > 0
              ? `Note ${item.order}`
              : item.contentType === "FLASHCARD"
              ? `Flashcard ${item.order}`
              : `Contenu ${item.order}`,
        })),
      })),
    };

    return {
      success: true,
      data: courseWithTitles,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course content for admin preview: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Get all course categories
 */
export async function getCourseCategoriesAction() {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { name: "asc" },
    });

    return categories;
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get course categories: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return [];
  }
}

/**
 * Update course features (admin only)
 */
export async function updateCourseFeaturesAction(
  courseId: string,
  features: Array<{ id: string; icon: string; text: string }>
): Promise<CourseActionResult> {
  try {
    await requireAdmin();

    await prisma.course.update({
      where: { id: courseId },
      data: { features },
    });

    revalidatePath(`/courses/${courseId}`);
    revalidatePath(`/dashboard/admin/courses/${courseId}`);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update course features: ${error instanceof Error ? error.message : "Unknown error"}`,
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
 * Update course testimonials (admin only)
 */
export async function updateCourseTestimonialsAction(
  courseId: string,
  testimonials: Array<{ id: string; name: string; role: string; text: string; avatar?: string }>
): Promise<CourseActionResult> {
  try {
    await requireAdmin();

    await prisma.course.update({
      where: { id: courseId },
      data: { testimonials },
    });

    revalidatePath(`/courses/${courseId}`);
    revalidatePath(`/dashboard/admin/courses/${courseId}`);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update course testimonials: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating testimonials",
    };
  }
}

/**
 * Update course about section (admin only)
 */
export async function updateCourseAboutAction(
  courseId: string,
  data: { shortDescription: string; aboutText: string }
): Promise<CourseActionResult> {
  try {
    await requireAdmin();

    await prisma.course.update({
      where: { id: courseId },
      data: {
        shortDescription: data.shortDescription,
        aboutText: data.aboutText,
      },
    });

    revalidatePath(`/courses/${courseId}`);
    revalidatePath(`/dashboard/admin/courses/${courseId}`);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update course about: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while updating the About section",
    };
  }
}
