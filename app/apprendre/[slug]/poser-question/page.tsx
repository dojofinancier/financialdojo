import { getCourseContentAction, getPublishedCourseBySlugAction } from "@/app/actions/courses";
import { notFound, redirect } from "next/navigation";
import { AskQuestionPage } from "@/components/course/ask-question-page";

interface AskQuestionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AskQuestionRoute({ params }: AskQuestionPageProps) {
  const { slug } = await params;

  try {
    // Look up course by slug
    const courseBySlug = await getPublishedCourseBySlugAction(slug);
    if (!courseBySlug) {
      console.error(`Course not found with slug: ${slug}`);
      notFound();
    }

    const actualCourseId = courseBySlug.id;

    // Get course content to verify access
    const courseResult = await getCourseContentAction(actualCourseId);

    if (!courseResult.success || !courseResult.data) {
      // Redirect back to course if access denied
      redirect(`/learn/${slug}`);
    }

    return (
      <AskQuestionPage
        courseId={actualCourseId}
        courseTitle={courseResult.data.title}
      />
    );
  } catch (error) {
    console.error("Error in AskQuestionRoute:", error);
    redirect(`/learn/${slug}`);
  }
}

