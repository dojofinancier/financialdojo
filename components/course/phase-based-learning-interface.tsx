"use client";

import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, RefreshCw, CheckCircle2, Target, Brain, FileText, Menu } from "lucide-react";
import { OrientationForm } from "./orientation-form";
import { OrientationVideo } from "./orientation-video";
import { OrientationHelpBubble } from "./orientation-help-bubble";
import { TodaysPlan } from "./todays-plan";
import { StudyPlan } from "./study-plan";
import { BehindScheduleWarning } from "./behind-schedule-warning";
import { ModuleDetailPage } from "./module-detail-page";
import { CourseSidebar } from "./course-sidebar";
import { Syllabus } from "./syllabus";
import { LearningTools } from "./learning-tools";
import { VideosTool } from "./tools/videos-tool";
import { NotesTool } from "./tools/notes-tool";
import { QuizzesTool } from "./tools/quizzes-tool";
import { FlashcardsTool } from "./tools/flashcards-tool";
import { ActivitiesTool } from "./tools/activities-tool";
import { ExamsTool } from "./tools/exams-tool";
import { QuestionBankTool } from "./tools/question-bank-tool";
import { CaseStudiesTool } from "./tools/case-studies-tool";
import { AskQuestionPage } from "./ask-question-page";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseSettings } from "@/lib/hooks/use-course-settings";

// Lazy load phase components to reduce initial bundle size
const Phase1Learn = lazy(() => import("./phase1-learn").then(m => ({ default: m.Phase1Learn })));
const Phase2Review = lazy(() => import("./phase2-review").then(m => ({ default: m.Phase2Review })));
const Phase3Practice = lazy(() => import("./phase3-practice").then(m => ({ default: m.Phase3Practice })));

// Lazy load heavy components that are not always needed (uses recharts, complex state)
const ExamPlayer = lazy(() => import("./exam-player").then(m => ({ default: m.ExamPlayer })));
const CaseStudyPlayer = lazy(() => import("./case-study-player").then(m => ({ default: m.CaseStudyPlayer })));
const StudentAnalyticsDashboard = lazy(() => import("./student-analytics-dashboard").then(m => ({ default: m.StudentAnalyticsDashboard })));

// Skeleton loader for phase components
const PhaseSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

// Skeleton loader for exam/case study players
const PlayerSkeleton = () => (
  <div className="space-y-4 p-6">
    <Skeleton className="h-10 w-1/2" />
    <Skeleton className="h-64 w-full" />
    <div className="flex gap-4">
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
    </div>
  </div>
);

type Course = {
  id: string;
  title: string;
  category?: {
    name: string;
  };
  recommendedStudyHoursMin?: number | null;
  recommendedStudyHoursMax?: number | null;
  orientationVideoUrl?: string | null;
  orientationText?: string | null;
  componentVisibility?: any;
  modules: Array<{
    id: string;
    title: string;
    shortTitle?: string | null;
    order: number;
    contentItems?: Array<{
      id: string;
      title: string;
      contentType: string;
      order: number;
    }>;
  }>;
};

type TodaysPlanData = {
  sections: {
    sessionCourte: any[];
    sessionLongue: any[];
    sessionCourteSupplementaire: any[];
    sessionLongueSupplementaire: any[];
  };
  totalBlocks: number;
  phase1Module: { id: string; title: string; order: number } | null;
};

interface PhaseBasedLearningInterfaceProps {
  course: Course;
  initialSettings?: any; // Settings passed from server to avoid client-side fetch
  initialTodaysPlan?: TodaysPlanData | null;
}


type Phase = "orientation" | "home" | "learn" | "review" | "practice" | "syllabus" | "tools" | "progress" | "question";
type NavigationItem = "home" | "learn" | "review" | "practice" | "syllabus" | "tools" | "progress" | "question" | `module-${string}`;

export function PhaseBasedLearningInterface({
  course,
  initialSettings,
  initialTodaysPlan,
}: PhaseBasedLearningInterfaceProps) {
  const router = useRouter();
  const [activePhase, setActivePhase] = useState<Phase>("orientation");
  const [activeItem, setActiveItem] = useState<NavigationItem>("home");
  
  // Use React Query for course settings - automatic caching and deduplication
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useCourseSettings(
    course.id,
    initialSettings
  );
  
  // Cache for loaded phase data to prevent redundant requests
  const [loadedPhases, setLoadedPhases] = useState<Set<string>>(new Set());
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedCaseStudyId, setSelectedCaseStudyId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper function to get URL parameters
  const getUrlParams = () => {
    if (typeof window === 'undefined') return { module: null, tab: null };
    const params = new URLSearchParams(window.location.search);
    return {
      module: params.get('module'),
      tab: params.get('tab'),
    };
  };

  // Handle navigation based on settings and URL parameters
  useEffect(() => {
    // Check URL parameters first (takes priority)
    const { module: moduleId } = getUrlParams();
    if (moduleId) {
      setSelectedModuleId(moduleId);
      setActivePhase("learn");
      setActiveItem(`module-${moduleId}` as NavigationItem);
      return;
    }

    // Use settings from React Query for navigation
    if (settings) {
      if (settings.orientationCompleted) {
        setActivePhase("home");
        setActiveItem("home");
      } else {
        setActivePhase("orientation");
      }
    } else if (!settingsLoading && !settingsError) {
      // No settings found and not loading - show orientation
      setActivePhase("orientation");
    }
  }, [settings, settingsLoading, settingsError]);

  const [studyPlanRefreshKey, setStudyPlanRefreshKey] = useState(0);
  
  const handleSettingsUpdated = () => {
    router.refresh();
    setStudyPlanRefreshKey((prev) => prev + 1);
    setMobileMenuOpen(false);
  };

  const handleNavigate = (item: NavigationItem) => {
    setActiveItem(item);
    if (item === "home") {
      setActivePhase("home");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
    } else if (item === "learn") {
      setActivePhase("learn");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("learn"));
    } else if (item.startsWith("module-")) {
      setActivePhase("learn");
      const moduleId = item.replace("module-", "");
      setSelectedModuleId(moduleId);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("learn"));
    } else if (item === "review") {
      setActivePhase("review");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("review"));
    } else if (item === "practice") {
      setActivePhase("practice");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("practice"));
    } else if (item === "question") {
      setActivePhase("question");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
    } else if (item === "syllabus") {
      setActivePhase("syllabus");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("syllabus"));
    } else if (item === "tools") {
      setActivePhase("tools");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("tools"));
    } else if (item === "progress") {
      setActivePhase("progress");
      setSelectedModuleId(null);
      setSelectedTool(null);
      setSelectedExamId(null);
      setLoadedPhases(prev => new Set(prev).add("progress"));
    }
  };

  const handleModuleBack = () => {
    setSelectedModuleId(null);
    setActiveItem("learn");
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

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show orientation if not completed
  if (!settings || !settings.orientationCompleted) {
    // Check if settings exist but form not completed (show video)
    // If no settings at all, show form first
    if (!settings) {
      return (
        <div className="min-h-screen bg-background">
          <div className="border-b">
            <div className="container mx-auto px-4 py-4">
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">Phase 0 - Orientation</p>
            </div>
          </div>
          <OrientationForm
            courseId={course.id}
            courseTitle={course.title}
            recommendedStudyHoursMin={course.recommendedStudyHoursMin}
            recommendedStudyHoursMax={course.recommendedStudyHoursMax}
            orientationVideoUrl={course.orientationVideoUrl}
            orientationText={course.orientationText}
            firstModuleId={course.modules.length > 0 ? course.modules[0].id : null}
            onComplete={(isFirstCreation) => {
              if (!isFirstCreation) {
                // If updating (not first creation), just refresh and go to home
                handleSettingsUpdated();
              }
              // If first creation, the form will show the video component
            }}
          />
        </div>
      );
    }

    // Settings exist but orientation not completed - show video
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground">Phase 0 - Orientation</p>
          </div>
        </div>
        <OrientationVideo
          courseId={course.id}
          courseTitle={course.title}
          orientationVideoUrl={course.orientationVideoUrl}
          orientationText={course.orientationText}
          firstModuleId={course.modules.length > 0 ? course.modules[0].id : null}
          onComplete={handleSettingsUpdated}
        />
      </div>
    );
  }

  const handleMobileNavigate = (item: NavigationItem) => {
    handleNavigate(item);
    setMobileMenuOpen(false); // Close mobile menu after navigation
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Course Sidebar Navigation */}
      <CourseSidebar
        course={course}
        activeItem={activeItem}
        onNavigate={handleNavigate}
        onSettingsUpdate={handleSettingsUpdated}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuChange={setMobileMenuOpen}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden sticky top-0 z-40 bg-background border-b flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold truncate flex-1 mr-2">{course.title}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Floating Help Bubble - Only show after orientation is completed */}
        <OrientationHelpBubble
          courseId={course.id}
          courseTitle={course.title}
          orientationVideoUrl={course.orientationVideoUrl}
        />
        <div className="container mx-auto px-4 py-4 sm:py-6 max-w-6xl">
          {/* Content based on active phase */}
          {activePhase === "home" && (
            <div className="space-y-4 sm:space-y-6">
              <BehindScheduleWarning courseId={course.id} />
              <div>
                <TodaysPlan
                  courseId={course.id}
                  orientationVideoUrl={course.orientationVideoUrl}
                  orientationText={course.orientationText}
                  initialPlanData={initialTodaysPlan}
                />
              </div>
              <div>
                <StudyPlan courseId={course.id} refreshKey={studyPlanRefreshKey} />
              </div>
            </div>
          )}
          {activePhase === "learn" && (
            <div>
              {selectedModuleId ? (
                <ModuleDetailPage
                  courseId={course.id}
                  moduleId={selectedModuleId}
                  onBack={handleModuleBack}
                  componentVisibility={course.componentVisibility as any}
                />
              ) : (
                <>
                  <Suspense fallback={<PhaseSkeleton />}>
                    <Phase1Learn
                      courseId={course.id}
                      course={course}
                      settings={settings}
                      onModuleSelect={(moduleId) => {
                        setSelectedModuleId(moduleId);
                        setActiveItem(`module-${moduleId}` as NavigationItem);
                      }}
                    />
                  </Suspense>
                </>
              )}
            </div>
          )}
          {/* Keep phase components mounted but hidden when not active */}
          <div className={activePhase === "review" ? "" : "hidden"}>
            <Suspense fallback={<PhaseSkeleton />}>
              <Phase2Review courseId={course.id} course={course} settings={settings} />
            </Suspense>
          </div>
          <div className={activePhase === "practice" ? "" : "hidden"}>
            <Suspense fallback={<PhaseSkeleton />}>
              <Phase3Practice courseId={course.id} course={course} settings={settings} />
            </Suspense>
          </div>
          {/* Keep syllabus mounted but hidden when not active */}
          <div className={activePhase === "syllabus" ? "" : "hidden"}>
            <Suspense fallback={<PhaseSkeleton />}>
              <Syllabus courseId={course.id} />
            </Suspense>
          </div>
          {activePhase === "tools" && (
            <div>
              {selectedExamId ? (
                <Suspense fallback={<PlayerSkeleton />}>
                  <ExamPlayer examId={selectedExamId} onExit={handleExamExit} />
                </Suspense>
              ) : selectedCaseStudyId ? (
                <Suspense fallback={<PlayerSkeleton />}>
                  <CaseStudyPlayer
                    caseStudyId={selectedCaseStudyId}
                    onExit={() => setSelectedCaseStudyId(null)}
                  />
                </Suspense>
              ) : selectedTool ? (
                <>
                  {selectedTool === "videos" && (
                    <VideosTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "notes" && (
                    <NotesTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "quizzes" && (
                    <QuizzesTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "flashcards" && (
                    <FlashcardsTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "activities" && (
                    <ActivitiesTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "exams" && (
                    <ExamsTool
                      courseId={course.id}
                      onBack={handleToolBack}
                      onStartExam={handleStartExam}
                    />
                  )}
                  {selectedTool === "question-bank" && (
                    <QuestionBankTool courseId={course.id} onBack={handleToolBack} />
                  )}
                  {selectedTool === "case-studies" && (
                    <CaseStudiesTool
                      courseId={course.id}
                      onBack={handleToolBack}
                    />
                  )}
                </>
              ) : (
                <>
                  <LearningTools courseId={course.id} onToolSelect={handleToolSelect} />
                </>
              )}
            </div>
          )}
          {activePhase === "progress" && (
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Progress and stats</h1>
              <Suspense fallback={<PhaseSkeleton />}>
                <StudentAnalyticsDashboard courseId={course.id} />
              </Suspense>
            </div>
          )}
          {activePhase === "question" && (
            <div>
              <AskQuestionPage courseId={course.id} courseTitle={course.title} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
