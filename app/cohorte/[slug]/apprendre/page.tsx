import { getCohortContentBySlugAction } from "@/app/actions/cohorts";
import { getUserCourseSettingsAction } from "@/app/actions/study-plan";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { CohortLearningInterface } from "@/components/cohort/cohort-learning-interface";
import { Suspense } from "react";

interface CohortLearningPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contentItemId?: string }>;
}

async function CohortLearningContent({
  params,
  searchParams,
}: CohortLearningPageProps) {
  const { slug } = await params;
  const { contentItemId } = await searchParams;

  console.log(`[CohortLearningPage] Attempting to load cohort with slug: ${slug}`);
  const result = await getCohortContentBySlugAction(slug);
  const user = await getCurrentUser();

  if (!("data" in result) || !result.success || !result.data) {
    const errorMessage = "error" in result ? result.error : "Unknown error";
    console.error(`[CohortLearningPage] Failed to load cohort content for slug ${slug}. Error: ${errorMessage}`);
    if (errorMessage?.includes("access") || errorMessage?.includes("inscrit")) {
      console.log(`[CohortLearningPage] Access denied or not enrolled, redirecting to /dashboard/student`);
      redirect(`/dashboard/student`);
    }
    console.log(`[CohortLearningPage] Cohort not found or other error, calling notFound()`);
    notFound();
  }

  const cohort = result.data;
  const currentUserId = user?.id;
  const currentUserRole = user?.role || "STUDENT";

  // Fetch course settings if cohort is linked to a course
  let initialSettings = null;
  if (cohort.courseId && user?.id) {
    try {
      const settingsResult = await getUserCourseSettingsAction(cohort.courseId);
      if (settingsResult.success && settingsResult.data) {
        initialSettings = settingsResult.data;
      }
    } catch (error) {
      console.error("Failed to fetch course settings:", error);
      // Continue without settings - PhaseBasedLearningInterface will fetch them
    }
  }

  return (
    <CohortLearningInterface
      cohort={cohort}
      initialContentItemId={contentItemId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      initialSettings={initialSettings}
    />
  );
}

export default function CohortLearningPage(props: CohortLearningPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement de la cohorte...</div>
        </div>
      }
    >
      <CohortLearningContent {...props} />
    </Suspense>
  );
}

