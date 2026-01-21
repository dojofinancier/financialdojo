import { getCourseContentAction } from "@/app/actions/courses";
import { getPublishedCourseBySlugAction } from "@/app/actions/courses";
import { getTodaysPlanAction, getUserCourseSettingsAction } from "@/app/actions/study-plan";
import { notFound, redirect } from "next/navigation";
import { CourseLearningInterface } from "@/components/course/learning-interface";
import { PhaseBasedLearningInterface } from "@/components/course/phase-based-learning-interface";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";

interface CourseLearningPageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ contentItemId?: string; module?: string; tab?: string }>;
}

export default async function CourseLearningPage({
  params,
  searchParams,
}: CourseLearningPageProps) {
  const { courseId } = await params;
  const { contentItemId, module, tab } = await searchParams;

  try {
    // Look up the course by slug
    const courseBySlug = await getPublishedCourseBySlugAction(courseId);
    if (!courseBySlug) {
      console.error(`Course not found with slug: ${courseId}`);
      notFound();
    }

    const actualCourseId = courseBySlug.id;

    // Fetch course content and settings in parallel for better performance
    const [courseResult, settingsResult, todaysPlanResult] = await Promise.all([
      getCourseContentAction(actualCourseId),
      getUserCourseSettingsAction(actualCourseId).catch(() => ({ success: false, data: null })),
      getTodaysPlanAction(actualCourseId).catch(() => ({ success: false, data: null })),
    ]);

    const result = courseResult;

    if (!result.success || !result.data) {
      console.error(`getCourseContentAction failed for course ${actualCourseId}:`, result.error);
      // If user is not enrolled or access denied, redirect to course detail page
      const errorMessage = result.error?.toLowerCase() || "";

      // If it's a generic error, try to get more details by checking enrollment directly
      if (errorMessage.includes("error loading") || !result.error) {
        // Generic error - check if course exists and user is enrolled
        try {
          const { requireAuth } = await import("@/lib/auth/require-auth");
          const user = await requireAuth();
          const enrollment = await prisma.enrollment.findFirst({
            where: {
              userId: user.id,
              courseId: actualCourseId,
              expiresAt: { gte: new Date() },
            },
          });

          if (enrollment) {
            // User is enrolled, but there's an error loading content
            // This might be a data issue - redirect to courses page
            const redirectPath = `/courses/${courseId}`;
            console.log(`User enrolled but content error, redirecting to: ${redirectPath}`);
            redirect(redirectPath);
          }
        } catch (checkError) {
          console.error("Error checking enrollment:", checkError);
        }
      }

      if (
        result.error &&
        (errorMessage.includes("inscrit") ||
          errorMessage.includes("access") ||
          errorMessage.includes("expired") ||
          errorMessage.includes("enrolled") ||
          errorMessage.includes("enrollment") ||
          errorMessage.includes("course not found") ||
          errorMessage.includes("published"))
      ) {
        // Redirect to courses page
        const redirectPath = `/courses/${courseId}`;
        console.log(`Redirecting to: ${redirectPath}`);
        redirect(redirectPath);
      }
      // For any other error, show 404
      console.error(`Unexpected error, showing 404. Error: ${result.error}`);
      notFound();
    }

    // Check if course is in "Professionnels" category - use phase-based system
    if (result.data?.category?.name === "Professionnels") {
      return (
        <Suspense
          fallback={
            <div className="container mx-auto p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
              </div>
            </div>
          }
        >
          <PhaseBasedLearningInterface
            course={result.data}
            initialSettings={settingsResult.success ? settingsResult.data : null}
            initialTodaysPlan={todaysPlanResult.success ? todaysPlanResult.data : null}
          />
        </Suspense>
      );
    }

    // For non-professional courses, use the traditional interface
    return (
      <Suspense
        fallback={
          <div className="container mx-auto p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
          </div>
        }
      >
        <CourseLearningInterface
          course={result.data}
          initialContentItemId={contentItemId}
        />
      </Suspense>
    );
  } catch (error) {
    console.error("Error in CourseLearningPage:", error);
    notFound();
  }
}
