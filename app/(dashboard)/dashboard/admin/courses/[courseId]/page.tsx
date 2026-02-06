import { requireAdmin } from "@/lib/auth/require-auth";
import { getCourseAction } from "@/app/actions/courses";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseForm } from "@/components/admin/courses/course-form";
import { ModuleManagement } from "@/components/admin/courses/module-management";
import { FlashcardManager } from "@/components/admin/courses/flashcard-manager";
import { LearningActivityManager } from "@/components/admin/courses/learning-activity-manager";
import { ExamManager } from "@/components/admin/courses/exam-manager";
import { QuestionBankManager } from "@/components/admin/courses/question-bank-manager";
import { CourseFAQManagement } from "@/components/admin/courses/course-faq-management";
import { CourseAboutManagement } from "@/components/admin/courses/course-about-management";
import { CourseFeaturesManagement } from "@/components/admin/courses/course-features-management";
import { CourseTestimonialsManagement } from "@/components/admin/courses/course-testimonials-management";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>;
}

async function CourseDetailContent({ params }: CourseDetailPageProps) {
  await requireAdmin();
  const { courseId } = await params;
  const course = await getCourseAction(courseId);

  if (!course) {
    notFound();
  }

  // Ensure all Decimal fields are converted to numbers for client components
  // This is a defensive check in case getCourseAction didn't convert them properly
  const serializedCourse = {
    ...course,
    price: typeof course.price === 'object' && course.price !== null && 'toNumber' in course.price
      ? (course.price as any).toNumber()
      : typeof course.price === 'number'
        ? course.price
        : Number(course.price),
    appointmentHourlyRate: course.appointmentHourlyRate
      ? (typeof course.appointmentHourlyRate === 'object' && course.appointmentHourlyRate !== null && 'toNumber' in course.appointmentHourlyRate
        ? (course.appointmentHourlyRate as any).toNumber()
        : typeof course.appointmentHourlyRate === 'number'
          ? course.appointmentHourlyRate
          : Number(course.appointmentHourlyRate))
      : null,
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/admin?tab=courses">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{serializedCourse.title}</h1>
        <p className="text-muted-foreground mt-2">
          Manage details and content for this course
        </p>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="details">Course details</TabsTrigger>
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
              code: serializedCourse.code || undefined,
              title: serializedCourse.title,
              description: serializedCourse.description || undefined,
              price: serializedCourse.price,
              accessDuration: serializedCourse.accessDuration,
              paymentType: serializedCourse.paymentType,
              categoryId: serializedCourse.categoryId,
              published: serializedCourse.published,
              appointmentHourlyRate: serializedCourse.appointmentHourlyRate ?? undefined,
              recommendedStudyHoursMin: serializedCourse.recommendedStudyHoursMin ?? undefined,
              recommendedStudyHoursMax: serializedCourse.recommendedStudyHoursMax ?? undefined,
              componentVisibility: serializedCourse.componentVisibility as any,
              heroImages: Array.isArray((course as any).heroImages) ? (course as any).heroImages : [],
              displayOrder: (course as any).displayOrder ?? undefined,
              orientationText: (course as any).orientationText ?? undefined,
              orientationVideoUrl: (course as any).orientationVideoUrl ?? undefined,
              pdfUrl: (course as any).pdfUrl ?? undefined,
              statsVideos: (course as any).statsVideos ?? undefined,
              statsQuestions: (course as any).statsQuestions ?? undefined,
              statsFlashcards: (course as any).statsFlashcards ?? undefined,
              statsVideosLabel: (course as any).statsVideosLabel ?? undefined,
              statsQuestionsLabel: (course as any).statsQuestionsLabel ?? undefined,
              statsFlashcardsLabel: (course as any).statsFlashcardsLabel ?? undefined,
            }}
          />
        </TabsContent>
        <TabsContent value="about" className="mt-6">
          <CourseAboutManagement
            courseId={courseId}
            initialShortDescription={(course as any).shortDescription || ""}
            initialAboutText={(course as any).aboutText || ""}
            initialAboutAccordionItems={(() => {
              const raw = (course as any).aboutAccordionItems;
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
            })()}
          />
        </TabsContent>
        <TabsContent value="features" className="mt-6">
          <CourseFeaturesManagement
            courseId={courseId}
            initialFeatures={(() => {
              const raw = (course as any).features;
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
            })()}
          />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-6">
          <CourseTestimonialsManagement
            courseId={courseId}
            initialTestimonials={(() => {
              const raw = (course as any).testimonials;
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
            })()}
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

export default function CourseDetailPage(props: CourseDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement du cours...</div>
        </div>
      }
    >
      <CourseDetailContent {...props} />
    </Suspense>
  );
}
