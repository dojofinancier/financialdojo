"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StudyPlanSettings } from "./study-plan-settings";
import {
  Home,
  Settings,
  BookOpen,
  Brain,
  Target,
  FileText,
  Wrench,
  BarChart3,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  slug?: string | null;
  title: string;
  recommendedStudyHoursMin?: number | null;
  recommendedStudyHoursMax?: number | null;
  modules: Array<{
    id: string;
    title: string;
    shortTitle?: string | null;
    order: number;
  }>;
};

type NavigationItem =
  | "home"
  | "learn"
  | "review"
  | "practice"
  | "syllabus"
  | "tools"
  | "progress"
  | "question"
  | `module-${string}`;

interface CourseSidebarProps {
  course: Course;
  activeItem?: NavigationItem;
  onNavigate?: (item: NavigationItem) => void;
  onSettingsUpdate?: () => void;
  mobileMenuOpen?: boolean;
  onMobileMenuChange?: (open: boolean) => void;
}

export function CourseSidebar({
  course,
  activeItem = "home",
  onNavigate,
  onSettingsUpdate,
  mobileMenuOpen = false,
  onMobileMenuChange,
}: CourseSidebarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPhase1Open, setIsPhase1Open] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);

  const handleClick = (item: NavigationItem) => {
    onNavigate?.(item);
    onMobileMenuChange?.(false); // Close mobile menu on navigation
  };

  // Sidebar content component (reusable for desktop and mobile)
  const SidebarContent = () => {
    // On mobile, always show expanded (don't use collapsed state)
    // Check if we're in mobile view (Sheet is open means mobile)
    const showExpanded = mobileMenuOpen || !isCollapsed;

    return (
      <div className="flex h-full flex-col">
        {/* Course Header with Collapse Button (only on desktop) */}
        <div className="border-b p-4 flex items-center justify-between flex-shrink-0">
          {showExpanded && (
            <h2 className="font-semibold text-lg truncate">{course.title}</h2>
          )}
          {!mobileMenuOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto p-2"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Main Navigation - Scrollable */}
        <nav className={cn("flex-1 overflow-y-auto p-4 space-y-1", !showExpanded && "px-2")}>
          {/* Plan du jour - Prominent (moved before settings) */}
          <Button
            variant={activeItem === "home" ? "default" : "ghost"}
            className={cn(
              "w-full font-semibold transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "home" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("home")}
            title={!showExpanded ? "Today's Plan" : undefined}
          >
            <Home className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Today's Plan"}
          </Button>

          {/* Plan settings */}
          {showExpanded && (
            <div className="mb-2">
              <StudyPlanSettings
                courseId={course.id}
                courseTitle={course.title}
                recommendedStudyHoursMin={course.recommendedStudyHoursMin}
                recommendedStudyHoursMax={course.recommendedStudyHoursMax}
                onUpdate={onSettingsUpdate}
              />
            </div>
          )}

          <Separator className="my-3" />

          {/* Phase 1 - Learn (Collapsible) */}
          {showExpanded && mounted && (
            <Collapsible open={isPhase1Open} onOpenChange={setIsPhase1Open}>
              <CollapsibleTrigger asChild>
                <Button
                  variant={activeItem === "learn" || activeItem.startsWith("module-") ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-all duration-200",
                    (activeItem === "learn" || activeItem.startsWith("module-")) && "bg-primary text-primary-foreground",
                    "hover:[&_svg]:scale-110"
                  )}
                >
                  <BookOpen className="mr-2 h-4 w-4 transition-transform duration-200" />
                  Phase 1 - Learn
                  {isPhase1Open ? (
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="transition-all duration-200">
                <div className="ml-6 mt-1 space-y-1">
                  {sortedModules.map((module) => {
                    const moduleItem = `module-${module.id}` as NavigationItem;
                    const displayTitle = module.shortTitle || module.title;
                    return (
                      <Button
                        key={module.id}
                        variant={activeItem === moduleItem ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start text-sm truncate transition-all duration-200",
                          activeItem === moduleItem && "bg-secondary text-secondary-foreground"
                        )}
                        onClick={() => handleClick(moduleItem)}
                        title={module.title} // Show full title on hover
                      >
                        {displayTitle}
                      </Button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Collapsed Phase 1 Icon */}
          {!showExpanded && (
            <Button
              variant={activeItem === "learn" || activeItem.startsWith("module-") ? "default" : "ghost"}
              className={cn(
                "w-full justify-center p-2 transition-all duration-200",
                (activeItem === "learn" || activeItem.startsWith("module-")) && "bg-primary text-primary-foreground",
                "hover:[&_svg]:scale-110"
              )}
              onClick={() => handleClick("learn")}
              title="Phase 1 - Learn"
            >
              <BookOpen className="h-4 w-4 transition-transform duration-200" />
            </Button>
          )}

          {/* Phase 2 - Review */}
          <Button
            variant={activeItem === "review" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "review" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("review")}
            title={!showExpanded ? "Phase 2 - Review" : undefined}
          >
            <Brain className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Phase 2 - Review"}
          </Button>

          {/* Phase 3 - Practice */}
          <Button
            variant={activeItem === "practice" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "practice" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("practice")}
            title={!showExpanded ? "Phase 3 - Practice" : undefined}
          >
            <Target className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Phase 3 - Practice"}
          </Button>
        </nav>

        {/* Fixed Bottom Section - Extra Tools */}
        <div className={cn("border-t bg-muted/40 flex-shrink-0 p-4 space-y-1", !showExpanded && "px-2")}>
          {/* Syllabus */}
          <Button
            variant={activeItem === "syllabus" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "syllabus" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("syllabus")}
            title={!showExpanded ? "Syllabus" : undefined}
          >
            <FileText className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Syllabus"}
          </Button>

          {/* Learning Tools */}
          <Button
            variant={activeItem === "tools" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "tools" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("tools")}
            title={!showExpanded ? "Learning Tools" : undefined}
          >
            <Wrench className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Learning Tools"}
          </Button>

          {/* Progress and stats */}
          <Button
            variant={activeItem === "progress" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "progress" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("progress")}
            title={!showExpanded ? "Progress and statistics" : undefined}
          >
            <BarChart3 className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Progress and statistics"}
          </Button>

          {showExpanded && <Separator className="my-3 -mx-4" />}

          {/* Ask a question */}
          <Button
            variant={activeItem === "question" ? "default" : "outline"}
            className={cn(
              "w-full border-primary/20 hover:bg-primary/10 transition-all duration-200",
              !showExpanded ? "justify-center p-2" : "justify-start",
              activeItem === "question" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("question")}
            title={!showExpanded ? "Ask a question" : undefined}
          >
            <MessageCircle className={cn("h-4 w-4 transition-transform duration-200", showExpanded && "mr-2")} />
            {showExpanded && "Ask a question"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col lg:border-r bg-muted/40 transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:w-16" : "lg:w-80"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuChange}>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px] p-0 overflow-y-auto">
          <SheetTitle className="sr-only">Course navigation</SheetTitle>
          <div className="h-full">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
