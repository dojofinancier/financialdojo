import { getPublishedCourseBySlugAction } from "@/app/actions/courses";
import { notFound } from "next/navigation";
import { CourseProductPage } from "@/components/courses/course-product-page";
import { Suspense } from "react";
import { CourseProductPageAuthed } from "./course-product-page-authed";

// Note: Caching is handled automatically by Next.js 16 with cacheComponents enabled
// The page will be cached and revalidated based on Next.js defaults

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = await params;
  const course = await getPublishedCourseBySlugAction(courseId);

  if (!course) {
    notFound();
  }

  // Ensure arrays are properly typed
  const courseWithDefaults = {
    ...course,
    shortDescription: (course as any).shortDescription || null,
    aboutText: (course as any).aboutText || null,
    features: Array.isArray((course as any).features) ? (course as any).features : [],
    testimonials: Array.isArray((course as any).testimonials) ? (course as any).testimonials : [],
    heroImages: Array.isArray((course as any).heroImages) ? (course as any).heroImages : [],
  };

  return (
    <Suspense fallback={<CourseProductPage course={courseWithDefaults} isEnrolled={false} />}>
      <CourseProductPageAuthed course={courseWithDefaults} />
    </Suspense>
  );
}
