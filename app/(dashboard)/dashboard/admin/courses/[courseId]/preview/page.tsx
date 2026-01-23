import { requireAdmin } from "@/lib/auth/require-auth";
import { getCourseContentForAdminPreviewAction } from "@/app/actions/courses";
import { notFound } from "next/navigation";
import { CourseLearningInterface } from "@/components/course/learning-interface";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

interface CoursePreviewPageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ contentItemId?: string }>;
}

async function CoursePreviewContent({
  params,
  searchParams,
}: CoursePreviewPageProps) {
  await requireAdmin();
  const { courseId } = await params;
  const { contentItemId } = await searchParams;

  const result = await getCourseContentForAdminPreviewAction(courseId);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin?tab=courses">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Student preview</h1>
              <p className="text-sm text-muted-foreground">{result.data.title}</p>
            </div>
          </div>
          <Link href={`/dashboard/admin/courses/${courseId}`}>
            <Button variant="outline" size="sm">
              Edit mode
            </Button>
          </Link>
        </div>
      </div>
      <CourseLearningInterface
        course={result.data}
        initialContentItemId={contentItemId}
        previewMode={true}
      />
    </div>
  );
}

export default function CoursePreviewPage(props: CoursePreviewPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <div className="container mx-auto p-6">
            <div className="text-muted-foreground">Loading preview...</div>
          </div>
        </div>
      }
    >
      <CoursePreviewContent {...props} />
    </Suspense>
  );
}
