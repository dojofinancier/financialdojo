#!/usr/bin/env python3
"""Generate English course-detail-page-client from French source."""
from pathlib import Path

FR = Path(r"C:\Users\User\Desktop\Dojo_Financier_App\components\admin\courses\course-detail-page-client.tsx")
OUT = Path(r"C:\Users\User\Desktop\financial_dojo\components\admin\courses\course-detail-page-client.tsx")

content = FR.read_text(encoding="utf-8")
content = content.replace("/tableau-de-bord/admin", "/dashboard/admin")

# Remove French-only imports and components
for block in [
    'const CourseConsolidatedNotesManagement = dynamic(\n  () =>\n    import("./course-consolidated-notes-management").then((m) => ({\n      default: m.CourseConsolidatedNotesManagement,\n    })),\n  { loading: () => <TabPanelSkeleton /> }\n);\n',
    'const CaseStudyManager = dynamic(\n  () => import("./case-study-manager").then((m) => ({ default: m.CaseStudyManager })),\n  { loading: () => <TabPanelSkeleton /> }\n);\n',
    'import { CloneCourseButton } from "@/components/admin/courses/clone-course-button";\n',
]:
    content = content.replace(block, "")

# Header: remove clone button block
content = content.replace(
    """        <div className="flex items-start justify-between mb-4">
          <Link href="/dashboard/admin?tab=courses">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la liste
            </Button>
          </Link>
          <CloneCourseButton
            courseId={courseId}
            courseTitle={course.title}
            courseCode={course.code}
            categoryId={course.categoryId}
          />
        </div>
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground mt-2">Gérez les détails et le contenu de ce cours</p>""",
    """        <Link href="/dashboard/admin?tab=courses">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground mt-2">Manage details and content for this course</p>""",
)

# Tabs
replacements = {
    "Détails": "Course details",
    "Parcours": "Program timeline",
    "À propos": "About",
    "Fonctionnalités": "Features",
    "Témoignages": "Testimonials",
    "Modules": "Modules and content",
    "Activités": "Learning activities",
    "Examens": "Exams",
    "Questions": "Question banks",
    "Études de cas": "Case studies",
    'value="parcours"': 'value="program-timeline"',
    'value="case-studies"': "",
    '<TabsTrigger value="case-studies">Case studies</TabsTrigger>\n          ': "",
    '<TabsContent value="case-studies" className="mt-6">\n          <CaseStudyManager courseId={courseId} />\n        </TabsContent>\n        ': "",
}
for old, new in replacements.items():
    content = content.replace(old, new)

# Details tab: remove consolidated notes + French helper text; add English pdf/stats fields
content = content.replace(
    """        <TabsContent value="details" className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Modifiez les paramètres du cours ci-dessous. Pour téléverser le PDF des notes de chapitre,
            utilisez la section « Notes de chapitre / Notes consolidées » en bas de cette page.
          </p>
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
              orientationVideoUrl: (courseRecord.orientationVideoUrl as string | null) ?? undefined,
              orientationText: (courseRecord.orientationText as string | null) ?? undefined,
              launchDate: (courseRecord.launchDate as Date | null) ?? undefined,
              productStats: parseProductStats(courseRecord.productStats),
            }}
          />
          <CourseConsolidatedNotesManagement
            courseId={courseId}
            initialConsolidatedNotesPdfUrl={(courseRecord.consolidatedNotesPdfUrl as string | null) ?? null}
          />
        </TabsContent>
        <TabsContent value="parcours" className="mt-6">""",
    """        <TabsContent value="details" className="mt-6">
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
        <TabsContent value="program-timeline" className="mt-6">""",
)

OUT.write_text(content, encoding="utf-8")
print("Wrote", OUT)
