"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, BookOpen, CheckCircle2, Circle, MessageCircle } from "lucide-react";
import { VideoPlayer } from "./video-player";
import { QuizComponent } from "./quiz-component";
import { FlashcardComponent } from "./flashcard-component";
import { NotesViewer } from "./notes-viewer";
import { MessagingButton } from "./messaging-button";
import type { Prisma } from "@prisma/client";

type ComponentVisibility = {
  videos?: boolean;
  quizzes?: boolean;
  flashcards?: boolean;
  notes?: boolean;
  messaging?: boolean;
  appointments?: boolean;
  virtualTutor?: boolean;
};

const DEFAULT_VISIBILITY: Required<ComponentVisibility> = {
  videos: true,
  quizzes: true,
  flashcards: true,
  notes: true,
  messaging: true,
  appointments: true,
  virtualTutor: false,
};

function normalizeVisibility(value: Prisma.JsonValue | ComponentVisibility | null | undefined): ComponentVisibility {
  const merge = (obj: unknown) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ...DEFAULT_VISIBILITY };
    const maybe = obj as Record<string, unknown>;
    return {
      ...DEFAULT_VISIBILITY,
      videos: typeof maybe.videos === "boolean" ? maybe.videos : DEFAULT_VISIBILITY.videos,
      quizzes: typeof maybe.quizzes === "boolean" ? maybe.quizzes : DEFAULT_VISIBILITY.quizzes,
      flashcards: typeof maybe.flashcards === "boolean" ? maybe.flashcards : DEFAULT_VISIBILITY.flashcards,
      notes: typeof maybe.notes === "boolean" ? maybe.notes : DEFAULT_VISIBILITY.notes,
      messaging: typeof maybe.messaging === "boolean" ? maybe.messaging : DEFAULT_VISIBILITY.messaging,
      appointments: typeof maybe.appointments === "boolean" ? maybe.appointments : DEFAULT_VISIBILITY.appointments,
      virtualTutor: typeof maybe.virtualTutor === "boolean" ? maybe.virtualTutor : DEFAULT_VISIBILITY.virtualTutor,
    };
  };

  if (typeof value === "string") {
    try {
      return merge(JSON.parse(value));
    } catch {
      return { ...DEFAULT_VISIBILITY };
    }
  }

  return merge(value);
}

type Course = {
  id: string;
  slug: string | null;
  title: string;
  // Prisma JSON fields are typed broadly (JsonValue includes string, etc.). Normalize at runtime.
  componentVisibility?: Prisma.JsonValue | ComponentVisibility | null;
  pdfUrl?: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    order: number;
    pdfUrl?: string | null;
    contentItems: Array<{
      id: string;
      title: string;
      contentType: string;
      order: number;
      video: any;
      quiz: any;
    }>;
  }>;
};

interface CourseLearningInterfaceProps {
  course: Course;
  initialContentItemId?: string;
  previewMode?: boolean; // If true, don't navigate away when selecting content items
}

export function CourseLearningInterface({
  course,
  initialContentItemId,
  previewMode = false,
}: CourseLearningInterfaceProps) {
  const router = useRouter();
  const [selectedContentItemId, setSelectedContentItemId] = useState<string | null>(
    initialContentItemId || null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get visibility settings (default to all visible if not set)
  const visibility = normalizeVisibility(course.componentVisibility);

  // Find all content items, filtered by visibility
  const allContentItems = course.modules.flatMap((module) =>
    module.contentItems
      .filter((item) => {
        // Filter based on component visibility
        if (item.contentType === "VIDEO" && !visibility.videos) return false;
        if (item.contentType === "QUIZ" && !visibility.quizzes) return false;
        if (item.contentType === "FLASHCARD" && !visibility.flashcards) return false;
        if (item.contentType === "NOTE" && !visibility.notes) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        moduleId: module.id,
        moduleTitle: module.title,
        modulePdfUrl: module.pdfUrl,
      }))
  );

  // Set initial content item if not provided
  useEffect(() => {
    if (!selectedContentItemId && allContentItems.length > 0) {
      setSelectedContentItemId(allContentItems[0].id);
    }
  }, [selectedContentItemId, allContentItems]);

  const selectedContentItem = allContentItems.find(
    (item) => item.id === selectedContentItemId
  );

  const handleContentItemSelect = (contentItemId: string) => {
    setSelectedContentItemId(contentItemId);
    setSidebarOpen(false);
    if (!previewMode) {
      router.push(`/learn/${course.slug || course.id}?contentItemId=${contentItemId}`, { scroll: false });
    }
  };

  const getNextContentItem = () => {
    const currentIndex = allContentItems.findIndex(
      (item) => item.id === selectedContentItemId
    );
    if (currentIndex < allContentItems.length - 1) {
      return allContentItems[currentIndex + 1];
    }
    return null;
  };

  const getPreviousContentItem = () => {
    const currentIndex = allContentItems.findIndex(
      (item) => item.id === selectedContentItemId
    );
    if (currentIndex > 0) {
      return allContentItems[currentIndex - 1];
    }
    return null;
  };

  const handleNext = () => {
    const next = getNextContentItem();
    if (next) {
      handleContentItemSelect(next.id);
    }
  };

  const handlePrevious = () => {
    const previous = getPreviousContentItem();
    if (previous) {
      handleContentItemSelect(previous.id);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-80 lg:flex-col lg:border-r">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <h2 className="font-semibold text-lg">{course.title}</h2>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-4 space-y-4">
              {course.modules.map((module) => (
                <div key={module.id} className="space-y-2">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Module {module.order}: {module.title}
                  </h3>
                  <div className="space-y-1 ml-4">
                    {module.contentItems.map((item) => {
                      const isSelected = item.id === selectedContentItemId;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleContentItemSelect(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.contentType === "VIDEO" && <span>▶</span>}
                            {item.contentType === "QUIZ" && <span>?</span>}
                            {item.contentType === "FLASHCARD" && <span>🃏</span>}
                            {item.contentType === "NOTE" && <span>📝</span>}
                            <span className="flex-1">{item.title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Poser une question button */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full justify-start border-primary/20 hover:bg-primary/10"
                  onClick={() => {
                    router.push(`/learn/${course.slug || course.id}/ask-question`);
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Poser une question
                </Button>
              </div>
            </nav>
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-4 left-4 z-50"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <h2 className="font-semibold text-lg">{course.title}</h2>
            </div>
            <ScrollArea className="flex-1">
              <nav className="p-4 space-y-4">
                {course.modules.map((module) => (
                  <div key={module.id} className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground">
                      Module {module.order}: {module.title}
                    </h3>
                    <div className="space-y-1 ml-4">
                      {module.contentItems
                        .filter((item) => {
                          // Filter based on component visibility
                          if (item.contentType === "VIDEO" && !visibility.videos) return false;
                          if (item.contentType === "QUIZ" && !visibility.quizzes) return false;
                          if (item.contentType === "FLASHCARD" && !visibility.flashcards) return false;
                          if (item.contentType === "NOTE" && !visibility.notes) return false;
                          return true;
                        })
                        .map((item) => {
                          const isSelected = item.id === selectedContentItemId;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleContentItemSelect(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.contentType === "VIDEO" && <span>▶</span>}
                                {item.contentType === "QUIZ" && <span>?</span>}
                                {item.contentType === "FLASHCARD" && <span>🃏</span>}
                                {item.contentType === "NOTE" && <span>📝</span>}
                                <span className="flex-1">{item.title}</span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
                {/* Poser une question button */}
                <div className="mt-4 pt-4 border-t px-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-primary/20 hover:bg-primary/10"
                    onClick={() => {
                      setSidebarOpen(false);
                      router.push(`/learn/${course.slug || course.id}/ask-question`);
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Poser une question
                  </Button>
                </div>
              </nav>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {selectedContentItem ? (
            <div className="space-y-6">
              {/* Content Header */}
              <div>
                <h1 className="text-2xl font-bold mb-2">{selectedContentItem.title}</h1>
                <p className="text-muted-foreground">
                  {selectedContentItem.moduleTitle}
                </p>
              </div>

              {/* Content Component */}
              <div>
                {selectedContentItem.contentType === "VIDEO" && selectedContentItem.video && visibility.videos && (
                  <VideoPlayer
                    video={selectedContentItem.video}
                    contentItemId={selectedContentItem.id}
                  />
                )}
                {selectedContentItem.contentType === "QUIZ" && selectedContentItem.quiz && visibility.quizzes && (
                  <QuizComponent
                    quiz={selectedContentItem.quiz}
                    contentItemId={selectedContentItem.id}
                  />
                )}
                {selectedContentItem.contentType === "FLASHCARD" && visibility.flashcards && (
                  <FlashcardComponent
                    courseId={course.id}
                    contentItemId={selectedContentItem.id}
                  />
                )}
                {selectedContentItem.contentType === "NOTE" && visibility.notes && (
                  <NotesViewer
                    contentItemId={selectedContentItem.id}
                    coursePdfUrl={course.pdfUrl}
                    modulePdfUrl={(selectedContentItem as any).modulePdfUrl}
                  />
                )}
              </div>

              {/* Messaging Button - Floating (if enabled and not quiz/exam) */}
              {visibility.messaging && selectedContentItem.contentType !== "QUIZ" && (
                <MessagingButton
                  contentItemId={selectedContentItem.id}
                  courseId={course.id}
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={!getPreviousContentItem()}
                >
                  ← Previous
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!getNextContentItem()}
                >
                  Next →
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">Select content to get started</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
