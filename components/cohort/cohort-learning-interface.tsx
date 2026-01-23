"use client";

import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { CohortSidebar } from "./cohort-sidebar";
import { GroupCoachingSessions } from "./group-coaching-sessions";
import { CohortMessageBoard } from "./cohort-message-board";
import { ModuleDetailPage } from "@/components/course/module-detail-page";
import { Syllabus } from "@/components/course/syllabus";
import { LearningTools } from "@/components/course/learning-tools";
import { VideosTool } from "@/components/course/tools/videos-tool";
import { NotesTool } from "@/components/course/tools/notes-tool";
import { QuizzesTool } from "@/components/course/tools/quizzes-tool";
import { FlashcardsTool } from "@/components/course/tools/flashcards-tool";
import { ActivitiesTool } from "@/components/course/tools/activities-tool";
import { ExamsTool } from "@/components/course/tools/exams-tool";
import { QuestionBankTool } from "@/components/course/tools/question-bank-tool";
import { CaseStudiesTool } from "@/components/course/tools/case-studies-tool";
import { ExamPlayer } from "@/components/course/exam-player";
import { AskQuestionPage } from "@/components/course/ask-question-page";
import { getCohortUnreadMessageCountAction } from "@/app/actions/cohort-messages";
import type { Prisma } from "@prisma/client";

// Lazy load phase components
const Phase1Learn = lazy(() => import("@/components/course/phase1-learn").then(m => ({ default: m.Phase1Learn })));
const Phase2Review = lazy(() => import("@/components/course/phase2-review").then(m => ({ default: m.Phase2Review })));
const Phase3Practice = lazy(() => import("@/components/course/phase3-practice").then(m => ({ default: m.Phase3Practice })));

// Lazy load heavy components
const CaseStudyPlayer = lazy(() => import("@/components/course/case-study-player").then(m => ({ default: m.CaseStudyPlayer })));
const StudentAnalyticsDashboard = lazy(() => import("@/components/course/student-analytics-dashboard").then(m => ({ default: m.StudentAnalyticsDashboard })));

// Skeleton loader for phase components
const PhaseSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

type Cohort = {
  id: string;
  title: string;
  description: string | null;
  courseId?: string | null;
  // Prisma JSON fields can be typed broadly; normalize at runtime.
  componentVisibility?: Prisma.JsonValue | {
    videos?: boolean;
    quizzes?: boolean;
    flashcards?: boolean;
    notes?: boolean;
    messaging?: boolean;
    appointments?: boolean;
    groupCoaching?: boolean;
    messageBoard?: boolean;
    virtualTutor?: boolean;
  } | null;
  recommendedStudyHoursMin?: number | null;
  recommendedStudyHoursMax?: number | null;
  modules: Array<{
    id: string;
    title: string;
    shortTitle?: string | null;
    description: string | null;
    order: number;
    contentItems?: Array<{
      id: string;
      title: string;
      contentType: string;
      order: number;
    }>;
  }>;
};

type NavigationItem = 
  | "coaching" 
  | "messages"
  | "learn" 
  | "review" 
  | "practice" 
  | "syllabus" 
  | "tools" 
  | "progress"
  | "question"
  | `module-${string}`;

interface CohortLearningInterfaceProps {
  cohort: Cohort;
  initialContentItemId?: string;
  currentUserId?: string;
  currentUserRole?: string;
  initialSettings?: any; // Course settings for phase-based learning
}

type CohortComponentVisibility = {
  videos?: boolean;
  quizzes?: boolean;
  flashcards?: boolean;
  notes?: boolean;
  messaging?: boolean;
  appointments?: boolean;
  groupCoaching?: boolean;
  messageBoard?: boolean;
  virtualTutor?: boolean;
};

const DEFAULT_COHORT_VISIBILITY: Required<CohortComponentVisibility> = {
  videos: true,
  quizzes: true,
  flashcards: true,
  notes: true,
  messaging: true,
  appointments: true,
  groupCoaching: true,
  messageBoard: true,
  virtualTutor: false,
};

function normalizeCohortVisibility(value: Prisma.JsonValue | CohortComponentVisibility | null | undefined): CohortComponentVisibility {
  const merge = (obj: unknown) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ...DEFAULT_COHORT_VISIBILITY };
    const maybe = obj as Record<string, unknown>;
    return {
      ...DEFAULT_COHORT_VISIBILITY,
      videos: typeof maybe.videos === "boolean" ? maybe.videos : DEFAULT_COHORT_VISIBILITY.videos,
      quizzes: typeof maybe.quizzes === "boolean" ? maybe.quizzes : DEFAULT_COHORT_VISIBILITY.quizzes,
      flashcards: typeof maybe.flashcards === "boolean" ? maybe.flashcards : DEFAULT_COHORT_VISIBILITY.flashcards,
      notes: typeof maybe.notes === "boolean" ? maybe.notes : DEFAULT_COHORT_VISIBILITY.notes,
      messaging: typeof maybe.messaging === "boolean" ? maybe.messaging : DEFAULT_COHORT_VISIBILITY.messaging,
      appointments: typeof maybe.appointments === "boolean" ? maybe.appointments : DEFAULT_COHORT_VISIBILITY.appointments,
      groupCoaching: typeof maybe.groupCoaching === "boolean" ? maybe.groupCoaching : DEFAULT_COHORT_VISIBILITY.groupCoaching,
      messageBoard: typeof maybe.messageBoard === "boolean" ? maybe.messageBoard : DEFAULT_COHORT_VISIBILITY.messageBoard,
      virtualTutor: typeof maybe.virtualTutor === "boolean" ? maybe.virtualTutor : DEFAULT_COHORT_VISIBILITY.virtualTutor,
    };
  };

  if (typeof value === "string") {
    try {
      return merge(JSON.parse(value));
    } catch {
      return { ...DEFAULT_COHORT_VISIBILITY };
    }
  }

  return merge(value);
}

export function CohortLearningInterface({
  cohort,
  initialContentItemId,
  currentUserId,
  currentUserRole,
  initialSettings,
}: CohortLearningInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Default to coaching sessions (home page)
  const [activeItem, setActiveItem] = useState<NavigationItem>("coaching");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedCaseStudyId, setSelectedCaseStudyId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Load unread message count
  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await getCohortUnreadMessageCountAction(cohort.id);
      if (result.success && typeof result.count === "number") {
        setUnreadMessageCount(result.count);
      }
    } catch (error) {
      // Silently fail
    }
  }, [cohort.id]);

  // Check URL params for navigation
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "sessions" || tabParam === "coaching") {
      setActiveItem("coaching");
    } else if (tabParam === "messages") {
      setActiveItem("messages");
    } else if (tabParam === "content" || tabParam === "learn") {
      setActiveItem("learn");
    } else if (tabParam?.startsWith("module-")) {
      const moduleId = tabParam.replace("module-", "");
      setActiveItem(`module-${moduleId}` as NavigationItem);
      setSelectedModuleId(moduleId);
    } else if (tabParam && ["review", "practice", "syllabus", "tools", "progress", "question"].includes(tabParam)) {
      setActiveItem(tabParam as NavigationItem);
    }
    // If no tab param, default stays as "coaching" (home)
  }, [searchParams]);

  // Load unread count on mount and when cohort changes
  useEffect(() => {
    loadUnreadCount();
    // Refresh unread count periodically (every 30 seconds)
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // Refresh unread count when navigating to messages tab
  useEffect(() => {
    if (activeItem === "messages") {
      loadUnreadCount();
    }
  }, [activeItem, loadUnreadCount]);

  // Get visibility settings (default to all visible if not set)
  const visibility = normalizeCohortVisibility(cohort.componentVisibility);

  // Use base courseId for content queries - all content belongs to the base course
  // Fall back to cohort.id if no base course is linked
  const contentCourseId = cohort.courseId || cohort.id;

  // Transform cohort to course format
  const courseData = {
    id: cohort.id,
    title: cohort.title,
    recommendedStudyHoursMin: cohort.recommendedStudyHoursMin,
    recommendedStudyHoursMax: cohort.recommendedStudyHoursMax,
    modules: cohort.modules,
  };

  const handleNavigate = (item: NavigationItem) => {
    setActiveItem(item);
    
    // Update URL
    const params = new URLSearchParams();
    if (item === "coaching") {
      params.set("tab", "sessions");
    } else if (item === "messages") {
      params.set("tab", "messages");
    } else if (item === "learn") {
      params.set("tab", "learn");
    } else if (item.startsWith("module-")) {
      const moduleId = item.replace("module-", "");
      params.set("tab", `module-${moduleId}`);
      setSelectedModuleId(moduleId);
    } else {
      params.set("tab", item);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleModuleBack = () => {
    setSelectedModuleId(null);
    setActiveItem("learn");
    const params = new URLSearchParams();
    params.set("tab", "learn");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool);
  };

  const handleToolBack = () => {
    setSelectedTool(null);
  };

  const handleStartExam = (examId: string) => {
    setSelectedExamId(examId);
  };

  const handleExamExit = () => {
    setSelectedExamId(null);
  };

  const handleStartCaseStudy = (caseStudyId: string) => {
    setSelectedCaseStudyId(caseStudyId);
  };

  const handleCaseStudyExit = () => {
    setSelectedCaseStudyId(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Cohort Sidebar */}
      <CohortSidebar
        cohort={{
          id: cohort.id,
          title: cohort.title,
          recommendedStudyHoursMin: cohort.recommendedStudyHoursMin,
          recommendedStudyHoursMax: cohort.recommendedStudyHoursMax,
          modules: cohort.modules,
          componentVisibility: visibility,
        }}
        activeItem={activeItem}
        onNavigate={handleNavigate}
        unreadMessageCount={unreadMessageCount}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Coaching Sessions (Home/Default) */}
          {activeItem === "coaching" && visibility.groupCoaching && (
            <div className="h-full">
              <GroupCoachingSessions cohortId={cohort.id} />
            </div>
          )}

          {/* Message Board */}
          {activeItem === "messages" && visibility.messageBoard && (
            <div className="h-full">
              <CohortMessageBoard
                cohortId={cohort.id}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onUnreadCountChange={setUnreadMessageCount}
              />
            </div>
          )}

          {/* Module Detail (when a specific module is selected) */}
          {(activeItem.startsWith("module-") || (activeItem === "learn" && selectedModuleId)) && selectedModuleId && (
            <ModuleDetailPage
              courseId={contentCourseId}
              moduleId={selectedModuleId}
              onBack={handleModuleBack}
              componentVisibility={visibility}
            />
          )}

          {/* Phase 1 - Apprendre (when no specific module is selected) */}
          {activeItem === "learn" && !selectedModuleId && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Phase 1 - Learn</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <Phase1Learn
                  courseId={contentCourseId}
                  course={courseData}
                  settings={initialSettings}
                  onModuleSelect={(moduleId) => {
                    setSelectedModuleId(moduleId);
                    setActiveItem(`module-${moduleId}` as NavigationItem);
                    const params = new URLSearchParams();
                    params.set("tab", `module-${moduleId}`);
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                />
              </Suspense>
            </div>
          )}

          {/* Phase 2 - Review */}
          {activeItem === "review" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Phase 2 - Review</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <Phase2Review courseId={contentCourseId} course={courseData} settings={initialSettings} />
              </Suspense>
            </div>
          )}

          {/* Phase 3 - Pratiquer */}
          {activeItem === "practice" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Phase 3 - Practice</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <Phase3Practice courseId={contentCourseId} course={courseData} settings={initialSettings} />
              </Suspense>
            </div>
          )}

          {/* Syllabus */}
          {activeItem === "syllabus" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Course syllabus</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <Syllabus courseId={contentCourseId} />
              </Suspense>
            </div>
          )}

          {/* Tools */}
          {activeItem === "tools" && (
            <div>
              {selectedExamId ? (
                <Suspense fallback={<PhaseSkeleton />}>
                  <ExamPlayer examId={selectedExamId} onExit={handleExamExit} />
                </Suspense>
              ) : selectedCaseStudyId ? (
                <Suspense fallback={<PhaseSkeleton />}>
                  <CaseStudyPlayer
                    caseStudyId={selectedCaseStudyId}
                    onExit={handleCaseStudyExit}
                  />
                </Suspense>
              ) : selectedTool ? (
                <>
                  {selectedTool === "videos" && (
                    <VideosTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "notes" && (
                    <NotesTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "quizzes" && (
                    <QuizzesTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "flashcards" && (
                    <FlashcardsTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "activities" && (
                    <ActivitiesTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "exams" && (
                    <ExamsTool
                      courseId={contentCourseId}
                      onBack={handleToolBack}
                      onStartExam={handleStartExam}
                    />
                  )}
                  {selectedTool === "question-bank" && (
                    <QuestionBankTool courseId={contentCourseId} onBack={handleToolBack} />
                  )}
                  {selectedTool === "case-studies" && (
                    <CaseStudiesTool
                      courseId={contentCourseId}
                      onBack={handleToolBack}
                      onStartCaseStudy={handleStartCaseStudy}
                    />
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold mb-6">Learning tools</h1>
                  <LearningTools courseId={contentCourseId} onToolSelect={handleToolSelect} />
                </>
              )}
            </div>
          )}

          {/* Progress */}
          {activeItem === "progress" && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Progress and stats</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <StudentAnalyticsDashboard courseId={contentCourseId} />
              </Suspense>
            </div>
          )}

          {/* Ask Question */}
          {activeItem === "question" && (
            <div>
              <AskQuestionPage courseId={contentCourseId} courseTitle={cohort.title} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
