"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCourseAdminPageAction } from "@/app/actions/courses";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";

const CourseForm = dynamic(
  () => import("./course-form").then((m) => ({ default: m.CourseForm })),
  { loading: () => <TabPanelSkeleton /> }
);
const CourseProgramTimelineManagement = dynamic(
  () =>
    import("./course-program-timeline-management").then((m) => ({
      default: m.CourseProgramTimelineManagement,
    })),
  { loading: () => <TabPanelSkeleton /> }
);
const CourseAboutManagement = dynamic(
  () => import("./course-about-management").then((m) => ({ default: m.CourseAboutManagement })),
  { loading: () => <TabPanelSkeleton /> }
);
const CourseFeaturesManagement = dynamic(
  () => import("./course-features-management").then((m) => ({ default: m.CourseFeaturesManagement })),
  { loading: () => <TabPanelSkeleton /> }
);
const CourseTestimonialsManagement = dynamic(
  () =>
    import("./course-testimonials-management").then((m) => ({
      default: m.CourseTestimonialsManagement,
    })),
  { loading: () => <TabPanelSkeleton /> }
);
const ModuleManagement = dynamic(
  () => import("./module-management").then((m) => ({ default: m.ModuleManagement })),
  { loading: () => <TabPanelSkeleton /> }
);
const FlashcardManager = dynamic(
  () => import("./flashcard-manager").then((m) => ({ default: m.FlashcardManager })),
  { loading: () => <TabPanelSkeleton /> }
);
const LearningActivityManager = dynamic(
  () => import("./learning-activity-manager").then((m) => ({ default: m.LearningActivityManager })),
  { loading: () => <TabPanelSkeleton /> }
);
const ExamManager = dynamic(
  () => import("./exam-manager").then((m) => ({ default: m.ExamManager })),
  { loading: () => <TabPanelSkeleton /> }
);
const QuestionBankManager = dynamic(
  () => import("./question-bank-manager").then((m) => ({ default: m.QuestionBankManager })),
  { loading: () => <TabPanelSkeleton /> }
);
const CourseFAQManagement = dynamic(
  () => import("./course-faq-management").then((m) => ({ default: m.CourseFAQManagement })),
  { loading: () => <TabPanelSkeleton /> }
);

function TabPanelSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

type AdminCourse = NonNullable<Awaited<ReturnType<typeof getCourseAdminPageAction>>>;

function parseProductStats(raw: unknown) {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((s) => s && typeof s === "object" && "value" in s && "label" in s)
      .map((s) => ({
        value: Number((s as { value: unknown }).value),
        label: String((s as { label: unknown }).label),
      }));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((s) => ({ value: Number(s?.value ?? 0), label: String(s?.label ?? "") }))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseAboutAccordionItems(raw: unknown) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function CourseDetailContent({
  course,
  courseId,
}: {
  course: AdminCourse;
  courseId: string;
}) {
  const courseRecord = course as AdminCourse & Record<string, unknown>;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/admin?tab=courses">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground mt-2">Manage details and content for this course</p>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="details">Course details</TabsTrigger>
          <TabsTrigger value="program-timeline">Program timeline</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="modules">Modules and content</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="activities">Learning activities</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="question-banks">Question banks</TabsTrigger>
          <TabsTrigger value="faqs">FAQ</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6">
          <CourseForm
            courseId={courseId}
            initialData={{
              code: course.code || undefined,
              title: course.title,
              description: course.description || undefined,
              price: course.price,
              accessDuration: course.accessDuration,
              paymentType: course.paymentType,
              categoryId: course.categoryId,
              published: course.published,
              appointmentHourlyRate: course.appointmentHourlyRate ?? undefined,
              recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? undefined,
              recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? undefined,
              componentVisibility: course.componentVisibility as Record<string, boolean> | undefined,
              heroImages: Array.isArray(courseRecord.heroImages) ? (courseRecord.heroImages as string[]) : [],
              displayOrder: (courseRecord.displayOrder as number | null) ?? undefined,
              orientationText: (courseRecord.orientationText as string | null) ?? undefined,
              orientationVideoUrl: (courseRecord.orientationVideoUrl as string | null) ?? undefined,
              pdfUrl: (courseRecord.pdfUrl as string | null) ?? undefined,
              statsVideos: (courseRecord.statsVideos as number | null) ?? undefined,
              statsQuestions: (courseRecord.statsQuestions as number | null) ?? undefined,
              statsFlashcards: (courseRecord.statsFlashcards as number | null) ?? undefined,
              statsVideosLabel: (courseRecord.statsVideosLabel as string | null) ?? undefined,
              statsQuestionsLabel: (courseRecord.statsQuestionsLabel as string | null) ?? undefined,
              statsFlashcardsLabel: (courseRecord.statsFlashcardsLabel as string | null) ?? undefined,
            }}
          />
        </TabsContent>
        <TabsContent value="program-timeline" className="mt-6">
          <CourseProgramTimelineManagement
            key={`parcours-${String(course.updatedAt)}`}
            courseId={courseId}
            initialProgramTimelineSteps={(courseRecord.programTimelineSteps as unknown) ?? null}
          />
        </TabsContent>
        <TabsContent value="about" className="mt-6">
          <CourseAboutManagement
            key={`about-${String(course.updatedAt)}`}
            courseId={courseId}
            initialShortDescription={(courseRecord.shortDescription as string) || ""}
            initialAboutText={(courseRecord.aboutText as string) || ""}
            initialAboutAccordionItems={parseAboutAccordionItems(courseRecord.aboutAccordionItems)}
          />
        </TabsContent>
        <TabsContent value="features" className="mt-6">
          <CourseFeaturesManagement
            key={`features-${String(course.updatedAt)}`}
            courseId={courseId}
            initialFeatures={((courseRecord.features as any[]) || [])}
          />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-6">
          <CourseTestimonialsManagement
            key={`testimonials-${String(course.updatedAt)}`}
            courseId={courseId}
            initialTestimonials={((courseRecord.testimonials as any[]) || [])}
          />
        </TabsContent>
        <TabsContent value="modules" className="mt-6">
          <ModuleManagement courseId={courseId} />
        </TabsContent>
        <TabsContent value="flashcards" className="mt-6">
          <FlashcardManager courseId={courseId} />
        </TabsContent>
        <TabsContent value="activities" className="mt-6">
          <LearningActivityManager courseId={courseId} />
        </TabsContent>
        <TabsContent value="exams" className="mt-6">
          <ExamManager courseId={courseId} />
        </TabsContent>
        <TabsContent value="question-banks" className="mt-6">
          <QuestionBankManager courseId={courseId} />
        </TabsContent>
        <TabsContent value="faqs" className="mt-6">
          <CourseFAQManagement courseId={courseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CourseDetailPageClient() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const loadCourse = useCallback(() => getCourseAdminPageAction(courseId), [courseId]);

  return (
    <AdminDetailPageLoader cacheKey={courseId} load={loadCourse}>
      {(course) => (
        <CourseDetailContent course={course} courseId={courseId} />
      )}
    </AdminDetailPageLoader>
  );
}
