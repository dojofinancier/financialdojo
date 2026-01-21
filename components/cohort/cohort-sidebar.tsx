"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Video,
  MessageSquare,
  BookOpen,
  Brain,
  Target,
  FileText,
  Wrench,
  BarChart3,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Cohort = {
  id: string;
  title: string;
  recommendedStudyHoursMin?: number | null;
  recommendedStudyHoursMax?: number | null;
  modules: Array<{
    id: string;
    title: string;
    shortTitle?: string | null;
    order: number;
  }>;
  componentVisibility?: {
    groupCoaching?: boolean;
    messageBoard?: boolean;
  } | null;
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

interface CohortSidebarProps {
  cohort: Cohort;
  activeItem?: NavigationItem;
  onNavigate?: (item: NavigationItem) => void;
  unreadMessageCount?: number;
}

export function CohortSidebar({
  cohort,
  activeItem = "coaching",
  onNavigate,
  unreadMessageCount = 0,
}: CohortSidebarProps) {
  const [mounted, setMounted] = useState(false);
  const [isPhase1Open, setIsPhase1Open] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sortedModules = [...cohort.modules].sort((a, b) => a.order - b.order);
  const visibility = cohort.componentVisibility || {
    groupCoaching: true,
    messageBoard: true,
  };

  const handleClick = (item: NavigationItem) => {
    onNavigate?.(item);
  };

  return (
    <aside className={cn(
      "hidden lg:flex lg:flex-col lg:border-r bg-muted/40 transition-all duration-300 ease-in-out",
      isCollapsed ? "lg:w-16" : "lg:w-80"
    )}>
      <div className="flex h-full flex-col">
        {/* Cohort Header with Collapse Button */}
        <div className="border-b p-4 flex items-center justify-between flex-shrink-0">
          {!isCollapsed && (
            <h2 className="font-semibold text-lg truncate">{cohort.title}</h2>
          )}
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
        </div>

        {/* Main Navigation - Scrollable */}
        <nav className={cn("flex-1 overflow-y-auto p-4 space-y-1", isCollapsed && "px-2")}>
          {/* Prominent Cohort-Specific Section */}
          {visibility.groupCoaching && (
            <Button
              variant={activeItem === "coaching" ? "default" : "outline"}
              className={cn(
                "w-full font-semibold transition-all duration-200 border-2",
                isCollapsed ? "justify-center p-2" : "justify-start",
                activeItem === "coaching" && "bg-primary text-primary-foreground border-primary",
                "hover:[&_svg]:scale-110"
              )}
              onClick={() => handleClick("coaching")}
              title={isCollapsed ? "Sessions de coaching" : undefined}
            >
              <Video className={cn("h-5 w-5 transition-transform duration-200", !isCollapsed && "mr-2")} />
              {!isCollapsed && "Sessions de coaching"}
            </Button>
          )}

          {visibility.messageBoard && (
            <Button
              variant={activeItem === "messages" ? "default" : "outline"}
              className={cn(
                "w-full font-semibold transition-all duration-200 border-2 relative",
                isCollapsed ? "justify-center p-2" : "justify-start",
                activeItem === "messages" && "bg-primary text-primary-foreground border-primary",
                "hover:[&_svg]:scale-110"
              )}
              onClick={() => handleClick("messages")}
              title={isCollapsed ? "Message board" : undefined}
            >
              <MessageSquare className={cn("h-5 w-5 transition-transform duration-200", !isCollapsed && "mr-2")} />
              {!isCollapsed && "Message board"}
              {unreadMessageCount > 0 && (
                <Badge
                  variant="destructive"
                  className={cn(
                    "absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs font-semibold",
                    isCollapsed && "-top-0.5 -right-0.5"
                  )}
                >
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </Badge>
              )}
            </Button>
          )}

          <Separator className="my-4" />

          {/* Phase 1 - Apprendre (Collapsible) */}
          {!isCollapsed && mounted && (
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
                  Phase 1 - Apprendre
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
          {isCollapsed && (
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

          {/* Phase 2 - Réviser */}
          <Button
            variant={activeItem === "review" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "review" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("review")}
            title={isCollapsed ? "Phase 2 - Review" : undefined}
          >
            <Brain className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Phase 2 - Review"}
          </Button>

          {/* Phase 3 - Pratiquer */}
          <Button
            variant={activeItem === "practice" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "practice" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("practice")}
            title={isCollapsed ? "Phase 3 - Pratiquer" : undefined}
          >
            <Target className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Phase 3 - Pratiquer"}
          </Button>
        </nav>

        {/* Fixed Bottom Section - Extra Tools */}
        <div className={cn("border-t bg-muted/40 flex-shrink-0 p-4 space-y-1", isCollapsed && "px-2")}>
          {/* Syllabus */}
          <Button
            variant={activeItem === "syllabus" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "syllabus" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("syllabus")}
            title={isCollapsed ? "Syllabus" : undefined}
          >
            <FileText className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Syllabus"}
          </Button>

          {/* Outils d'apprentissage */}
          <Button
            variant={activeItem === "tools" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "tools" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("tools")}
            title={isCollapsed ? "Outils d'apprentissage" : undefined}
          >
            <Wrench className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Outils d'apprentissage"}
          </Button>

          {/* Progrès et statistiques */}
          <Button
            variant={activeItem === "progress" ? "default" : "ghost"}
            className={cn(
              "w-full transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "progress" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("progress")}
            title={isCollapsed ? "Progress and statistics" : undefined}
          >
            <BarChart3 className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Progress and statistics"}
          </Button>

          {!isCollapsed && <Separator className="my-3 -mx-4" />}

          {/* Poser une question */}
          <Button
            variant={activeItem === "question" ? "default" : "outline"}
            className={cn(
              "w-full border-primary/20 hover:bg-primary/10 transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "justify-start",
              activeItem === "question" && "bg-primary text-primary-foreground",
              "hover:[&_svg]:scale-110"
            )}
            onClick={() => handleClick("question")}
            title={isCollapsed ? "Poser une question" : undefined}
          >
            <MessageCircle className={cn("h-4 w-4 transition-transform duration-200", !isCollapsed && "mr-2")} />
            {!isCollapsed && "Poser une question"}
          </Button>
        </div>
      </div>
    </aside>
  );
}















