"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FileText, CheckCircle2, XCircle, ArrowLeft, Video as VideoIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { getModuleContentAction } from "@/app/actions/module-content";
import { markModuleAsLearnedAction } from "@/app/actions/study-plan";
import { submitQuizAttemptAction, getQuizAttemptsAction } from "@/app/actions/quizzes";
import {
  getModuleQuizProgressAction,
  startSupplementaryQuizAction,
  loadSupplementaryQuestionsForRetakeAction,
} from "@/app/actions/module-quiz";
import type { QuizQuestionSnapshotPublic, QuizQuestionSnapshotItem } from "@/lib/types/module-quiz";
import { getStudentModuleNoteAction, saveStudentModuleNoteAction } from "@/app/actions/student-notes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, StickyNote, Save, Presentation } from "lucide-react";
import { SlideDeckViewer } from "./slide-deck-viewer";
import { SanitizedHtmlBlock } from "@/components/ui/sanitized-html-block";
import {
  getAnswerDisplay,
  getOptionLetter,
  getOrderedOptionKeys,
  resolveAnswerIndex,
} from "@/lib/utils/quiz-answer-display";

interface ModuleDetailPageProps {
  courseId: string;
  moduleId: string;
  onBack: () => void;
  componentVisibility?: {
    videos?: boolean;
    quizzes?: boolean;
    notes?: boolean;
    slides?: boolean;
      } | null;
}

type Video = {
  id: string;
  order: number;
  video: {
    id: string;
    vimeoUrl: string;
    duration: number | null;
    transcript: string | null;
  };
};

type Note = {
  id: string;
  order: number;
  note: {
    id: string;
    content: string;
  };
};

type Quiz = {
  id: string;
  order: number;
  quiz: {
    id: string;
    title: string;
    passingScore: number;
    timeLimit: number | null;
    questions: Array<{
      id: string;
      order: number;
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string | null;
    }>;
  };
};

export function ModuleDetailPage({ courseId, moduleId, onBack, componentVisibility }: ModuleDetailPageProps) {
  // Get component visibility settings (default to enabled if not set)
  const videosEnabled = componentVisibility?.videos !== false;
  const quizzesEnabled = componentVisibility?.quizzes !== false;
  const notesEnabled = componentVisibility?.notes !== false;
  const slidesEnabled = componentVisibility?.slides === true; // Default to false
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [progress, setProgress] = useState<any>(null);
  
  const modulePdfUrl = module?.pdfUrl ?? null;
  const coursePdfUrl = module?.coursePdfUrl ?? null;
  const showModulePdfDownload = !!modulePdfUrl;
  const showCoursePdfDownload = !!coursePdfUrl;
  
  // Determine initial tab based on what's enabled and available
  const getInitialTab = (): "videos" | "notes" | "quiz" | "slides" => {
    if (videosEnabled && videos.length > 0) return "videos";
    if (notesEnabled) return "notes";
    if (slidesEnabled && slideImages.length > 0) return "slides";
    if (quizzesEnabled) return "quiz";
    return "notes";
  };
  
  const [activeTab, setActiveTab] = useState<"videos" | "notes" | "quiz" | "slides">(getInitialTab());
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, string>>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState<Record<string, number>>({});
  const [studentNote, setStudentNote] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<Record<string, Array<{
    id: string;
    score: number;
    completedAt: Date;
    passed?: boolean;
    answers?: Record<string, string>;
    quizSequence?: number;
    label?: string;
    questionsSnapshot?: QuizQuestionSnapshotItem[] | null;
  }>>>({});
  const [quizProgress, setQuizProgress] = useState<Record<string, {
    passingScore: number;
    unlockedQuiz2: boolean;
    unlockedQuiz3: boolean;
    supplementaryAvailable: boolean;
    hasQuiz2Set: boolean;
    hasQuiz3Set: boolean;
  }>>({});
  const [activeQuizSequence, setActiveQuizSequence] = useState<Record<string, 1 | 2 | 3>>({});
  const [supplementaryQuestions, setSupplementaryQuestions] = useState<
    Record<string, QuizQuestionSnapshotPublic[]>
  >({});
  const [loadingAttempts, setLoadingAttempts] = useState<Record<string, boolean>>({});
  const [expandedAttemptId, setExpandedAttemptId] = useState<Record<string, string | null>>({});
  const [startingSupplementary, setStartingSupplementary] = useState<string | null>(null);

  const getQuizSessionKey = (quizId: string, sequence: number) => `${quizId}:${sequence}`;

  useEffect(() => {
    loadModuleContent();
    loadStudentNote();
    
    // Check URL parameters for tab
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'videos' || tab === 'notes' || tab === 'quiz' || tab === 'slides') {
      setActiveTab(tab);
    }
  }, [moduleId]);

  // Load quiz attempts and progress when quizzes are loaded
  useEffect(() => {
    if (quizzes.length > 0) {
      loadQuizAttempts();
      loadQuizProgress();
    }
  }, [quizzes, moduleId]);

  // Update active tab if the selected tab is no longer available
  useEffect(() => {
    if (loading) return;

    const firstAvailableTab = (): "videos" | "notes" | "quiz" | "slides" => {
      if (videosEnabled && videos.length > 0) return "videos";
      if (notesEnabled) return "notes";
      if (slidesEnabled && slideImages.length > 0) return "slides";
      if (quizzesEnabled) return "quiz";
      return "notes";
    };

    const tabAvailable =
      (activeTab === "videos" && videosEnabled && videos.length > 0) ||
      (activeTab === "notes" && notesEnabled) ||
      (activeTab === "slides" && slidesEnabled && slideImages.length > 0) ||
      (activeTab === "quiz" && quizzesEnabled);

    if (!tabAvailable) {
      const next = firstAvailableTab();
      if (next !== activeTab) {
        setActiveTab(next);
      }
    }
  }, [
    loading,
    activeTab,
    videosEnabled,
    videos.length,
    notesEnabled,
    quizzesEnabled,
    slidesEnabled,
    slideImages.length,
  ]);

  const loadStudentNote = async () => {
    try {
      const result = await getStudentModuleNoteAction(moduleId);
      if (result.success && result.data) {
        setStudentNote(result.data.content || "");
        setNoteSaved(result.data.exists);
      }
    } catch (error) {
      console.error("Error loading student note:", error);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      const result = await saveStudentModuleNoteAction(moduleId, studentNote);
      if (result.success) {
        setNoteSaved(true);
        toast.success("Note sauvegardée");
        // Reset the saved indicator after 2 seconds
        setTimeout(() => setNoteSaved(false), 2000);
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save");
    } finally {
      setSavingNote(false);
    }
  };

  const loadModuleContent = async () => {
    setLoading(true);
    try {
      const result = await getModuleContentAction(moduleId);
      if (result.success && result.data) {
        setModule(result.data.module);
        setVideos(result.data.videos);
        setNotes(result.data.notes);
        setQuizzes(result.data.quizzes);
        setSlideImages(result.data.slideImages || []);
        setProgress(result.data.progress);
      } else {
        toast.error(result.error || "Failed to load module");
      }
    } catch (error) {
      console.error("Error loading module content:", error);
      toast.error("Failed to load module");
    } finally {
      setLoading(false);
    }
  };


  const loadQuizAttempts = async () => {
    try {
      const attemptsPromises = quizzes.map(async (quizItem) => {
        setLoadingAttempts((prev) => ({ ...prev, [quizItem.quiz.id]: true }));
        try {
          const attempts = await getQuizAttemptsAction(quizItem.quiz.id);
          return { quizId: quizItem.quiz.id, attempts };
        } catch (error) {
          console.error(`Error loading attempts for quiz ${quizItem.quiz.id}:`, error);
          return { quizId: quizItem.quiz.id, attempts: [] };
        } finally {
          setLoadingAttempts((prev) => ({ ...prev, [quizItem.quiz.id]: false }));
        }
      });

      const results = await Promise.all(attemptsPromises);
      const attemptsMap: Record<string, Array<{
        id: string;
        score: number;
        completedAt: Date;
        passed?: boolean;
        answers?: Record<string, string>;
      }>> = {};

      results.forEach(({ quizId, attempts }) => {
        if (attempts && Array.isArray(attempts)) {
          const quizItem = quizzes.find(q => q.quiz.id === quizId);
          const passingScore = quizItem?.quiz.passingScore || 0;
          attemptsMap[quizId] = attempts.map((attempt: any) => ({
            id: attempt.id,
            score: attempt.score,
            completedAt: new Date(attempt.completedAt),
            passed: attempt.score >= passingScore,
            answers: (attempt.answers as Record<string, string>) || {},
            quizSequence: attempt.quizSequence ?? 1,
            label: attempt.label ?? `Quiz ${attempt.quizSequence ?? 1} · Attempt 1`,
            questionsSnapshot: attempt.questionsSnapshot ?? null,
          }));
        }
      });

      setQuizAttempts(attemptsMap);
    } catch (error) {
      console.error("Error loading quiz attempts:", error);
    }
  };

  const loadQuizProgress = async () => {
    const mainQuiz = quizzes[0];
    if (!mainQuiz) return;
    try {
      const result = await getModuleQuizProgressAction(moduleId, mainQuiz.quiz.id);
      if (result.success && result.data) {
        setQuizProgress((prev) => ({
          ...prev,
          [mainQuiz.quiz.id]: result.data as typeof quizProgress[string],
        }));
      }
    } catch (error) {
      console.error("Error loading quiz progress:", error);
    }
  };

  const resetQuizSession = (quizId: string, sequence: 1 | 2 | 3) => {
    const sessionKey = getQuizSessionKey(quizId, sequence);
    setQuizSubmitted((prev) => ({ ...prev, [sessionKey]: false }));
    setQuizAnswers((prev) => ({ ...prev, [quizId]: {} }));
    setCurrentQuizIndex((prev) => ({ ...prev, [quizId]: 0 }));
  };

  const handleRetakeQuiz = async (quizId: string, sequence: 1 | 2 | 3) => {
    if (sequence === 2 || sequence === 3) {
      const result = await loadSupplementaryQuestionsForRetakeAction(
        quizId,
        sequence
      );
      if (!result.success || !result.data) {
        toast.error(result.error || "Impossible de charger le quiz");
        return;
      }
      const data = result.data as { questions: QuizQuestionSnapshotPublic[] };
      setSupplementaryQuestions((prev) => ({
        ...prev,
        [quizId]: data.questions,
      }));
    }
    setActiveQuizSequence((prev) => ({ ...prev, [quizId]: sequence }));
    resetQuizSession(quizId, sequence);
  };

  const handleStartSupplementaryQuiz = async (quizId: string, sequence: 2 | 3) => {
    setStartingSupplementary(`${quizId}:${sequence}`);
    try {
      const result = await startSupplementaryQuizAction(moduleId, quizId, sequence);
      if (!result.success || !result.data) {
        toast.error(result.error || "Impossible de démarrer le quiz");
        return;
      }
      const data = result.data as {
        questions: QuizQuestionSnapshotPublic[];
        quizSequence: 2 | 3;
      };
      setSupplementaryQuestions((prev) => ({
        ...prev,
        [quizId]: data.questions,
      }));
      setActiveQuizSequence((prev) => ({ ...prev, [quizId]: sequence }));
      resetQuizSession(quizId, sequence);
      await loadQuizProgress();
    } catch (error) {
      console.error("Error starting supplementary quiz:", error);
      toast.error("Failed to start quiz");
    } finally {
      setStartingSupplementary(null);
    }
  };

  const handleMarkAsComplete = async () => {
    if (!confirm("Mark this module as completed?")) {
      return;
    }

    setMarkingComplete(true);
    try {
      const result = await markModuleAsLearnedAction(courseId, moduleId);
      if (result.success) {
        toast.success("Module marked as completed!");
        await loadModuleContent(); // Reload to update progress
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch (error) {
      console.error("Error marking module as complete:", error);
      toast.error("Failed to update");
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleQuizAnswerChange = (quizId: string, questionId: string, answer: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [quizId]: {
        ...prev[quizId],
        [questionId]: answer,
      },
    }));
  };

  const handleSubmitQuiz = async (quizItem: Quiz) => {
    const quiz = quizItem.quiz;
    const sequence = activeQuizSequence[quiz.id] ?? 1;
    const sessionKey = getQuizSessionKey(quiz.id, sequence);

    const displayQuestions =
      sequence === 1
        ? quiz.questions
        : (supplementaryQuestions[quiz.id] ?? []);

    if (displayQuestions.length === 0) {
      toast.error("No questions to submit");
      return;
    }

    const answers = quizAnswers[quiz.id] || {};
    const allAnswered = displayQuestions.every((q) => answers[q.id]);
    if (!allAnswered) {
      toast.error("Veuillez répondre à toutes les questions");
      return;
    }

    setSubmittingQuiz(quiz.id);
    try {
      const result = await submitQuizAttemptAction({
        quizId: quiz.id,
        answers,
        timeSpent: 0,
        quizSequence: sequence,
        moduleId: sequence > 1 ? moduleId : undefined,
      });

      if (result.success && result.data) {
        setQuizSubmitted((prev) => ({ ...prev, [sessionKey]: true }));
        if (result.data.passed) {
          toast.success(`Quiz passed! Score: ${result.data.score}%`);
        } else {
          toast.warning(`Score: ${result.data.score}%. Note de passage: ${quiz.passingScore}%`);
        }
        await loadQuizAttempts();
        await loadQuizProgress();
      } else {
        toast.error(result.error || "Failed to submit");
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to submit");
    } finally {
      setSubmittingQuiz(null);
    }
  };


  // Helper function to extract Vimeo embed URL (from FIN3500-platform)
  const getVimeoEmbedUrl = (vimeoUrl: string): string => {
    // If it's already a full embed URL with parameters, extract the src
    if (vimeoUrl.includes('player.vimeo.com')) {
      // Extract the src URL from iframe tag if it's wrapped in HTML
      const srcMatch = vimeoUrl.match(/src="([^"]+)"/);
      if (srcMatch) {
        return srcMatch[1].replace(/&amp;/g, '&');
      }
      // If it's just the URL, return it
      return vimeoUrl.replace(/&amp;/g, '&');
    }
    
    // Otherwise, extract the video ID and create a basic embed URL
    const vimeoIdMatch = vimeoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoIdMatch) {
      return `https://player.vimeo.com/video/${vimeoIdMatch[1]}?autoplay=0&title=0&byline=0&portrait=0`;
    }
    
    return vimeoUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!module) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Module not found</p>
        </CardContent>
      </Card>
    );
  }

  const isCompleted = progress?.learnStatus === "LEARNED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold break-words">{module.title}</h1>
          {module.description && (
            <p className="text-muted-foreground mt-2 break-words">{module.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto">
          {isCompleted ? (
            <Badge variant="default" className="h-8 w-full sm:w-auto justify-center">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complété
            </Badge>
          ) : (
            <Button 
              onClick={handleMarkAsComplete} 
              disabled={markingComplete}
              className="w-full sm:w-auto"
            >
              {markingComplete ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marquer comme complété
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className={`grid w-full ${
          (() => {
            const count = [videosEnabled && videos.length > 0, notesEnabled, slidesEnabled && slideImages.length > 0, quizzesEnabled].filter(Boolean).length;
            return count === 4 ? 'grid-cols-4' : count === 3 ? 'grid-cols-3' : count === 2 ? 'grid-cols-2' : 'grid-cols-1';
          })()
        }`}>
          {videosEnabled && videos.length > 0 && (
            <TabsTrigger value="videos">
              <VideoIcon className="h-4 w-4 mr-2" />
              Vidéos
            </TabsTrigger>
          )}
          {notesEnabled && (
            <TabsTrigger value="notes">
              <FileText className="h-4 w-4 mr-2" />
              Notes du cours
            </TabsTrigger>
          )}
          {slidesEnabled && slideImages.length > 0 && (
            <TabsTrigger value="slides">
              <Presentation className="h-4 w-4 mr-2" />
              Slides
            </TabsTrigger>
          )}
          {quizzesEnabled && (
            <TabsTrigger value="quiz">
              <Play className="h-4 w-4 mr-2" />
              Quiz
            </TabsTrigger>
          )}
        </TabsList>

        {/* Videos Tab - Only show if videos are enabled and available */}
        {videosEnabled && videos.length > 0 && (
          <TabsContent value="videos" className="mt-6">
            <div className="space-y-4">
              {videos.map((videoItem) => {
                const embedUrl = getVimeoEmbedUrl(videoItem.video.vimeoUrl);
                return (
                  <Card key={videoItem.id}>
                    <CardContent className="pt-6">
                      <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
                        <iframe
                          src={embedUrl}
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                          title={`Vidéo ${videoItem.order}`}
                        />
                      </div>
                      {videoItem.video.transcript && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="text-sm font-semibold mb-2">Transcription:</div>
                          <div className="text-sm whitespace-pre-wrap">{videoItem.video.transcript}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          {notes.length === 0 ? (
            <>
              <Card>
                {showModulePdfDownload && (
                  <CardHeader className="flex flex-row items-center justify-end gap-3 pb-2">
                    <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
                      <a
                        href={modulePdfUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger les notes détaillées
                      </a>
                    </Button>
                  </CardHeader>
                )}
                <CardContent className={showModulePdfDownload ? "pt-0 py-12 text-center" : "py-12 text-center"}>
                  <p className="text-muted-foreground">No notes available for this module.</p>
                </CardContent>
              </Card>
              {showCoursePdfDownload && (
                <div className="pt-2 flex justify-end">
                  <a
                    href={coursePdfUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger le document consolidé (PDF)
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {notes.map((noteItem) => (
                <Card key={noteItem.id}>
                  {showModulePdfDownload && (
                    <CardHeader className="flex flex-row items-center justify-end gap-3 pb-2">
                      <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
                        <a
                          href={modulePdfUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger les notes détaillées
                        </a>
                      </Button>
                    </CardHeader>
                  )}
                  <CardContent className={showModulePdfDownload ? "pt-0" : "pt-6"}>
                    <div className="note-content prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: noteItem.note.content }} />
                  </CardContent>
                </Card>
              ))}
              {showCoursePdfDownload && (
                <div className="pt-2 flex justify-end">
                  <a
                    href={coursePdfUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger le document consolidé (PDF)
                  </a>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Slides Tab */}
        {slidesEnabled && slideImages.length > 0 && (
          <TabsContent value="slides" className="mt-6">
            <SlideDeckViewer slideImages={slideImages} />
          </TabsContent>
        )}

        {/* Quiz Tab */}
        <TabsContent value="quiz" className="mt-6">
          {quizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No quiz available for this module.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {quizzes.map((quizItem, quizItemIndex) => {
                const quiz = quizItem.quiz;
                const isMainModuleQuiz = quizItemIndex === 0;
                const sequence: 1 | 2 | 3 = isMainModuleQuiz
                  ? (activeQuizSequence[quiz.id] ?? 1)
                  : 1;
                const sessionKey = getQuizSessionKey(quiz.id, sequence);
                const isSubmitted = quizSubmitted[sessionKey];
                const isSubmitting = submittingQuiz === quiz.id;
                const answers = quizAnswers[quiz.id] || {};
                const currentIndex = currentQuizIndex[quiz.id] || 0;
                const progress = isMainModuleQuiz ? quizProgress[quiz.id] : undefined;

                type DisplayQuestion = {
                  id: string;
                  question: string;
                  options: Record<string, string>;
                  explanation?: string | null;
                  correctAnswer?: string;
                };

                const displayQuestions: DisplayQuestion[] =
                  sequence === 1
                    ? quiz.questions.map((q) => ({
                        id: q.id,
                        question: q.question,
                        options: (q.options as Record<string, string>) || {},
                        explanation: q.explanation,
                        correctAnswer: q.correctAnswer,
                      }))
                    : (supplementaryQuestions[quiz.id] ?? []).map((q) => ({
                        id: q.id,
                        question: q.question,
                        options: q.options,
                      }));

                const totalQuestions = displayQuestions.length;
                const currentQuestion = displayQuestions[currentIndex];

                const handlePrevious = () => {
                  if (currentIndex > 0) {
                    setCurrentQuizIndex((prev) => ({
                      ...prev,
                      [quiz.id]: currentIndex - 1,
                    }));
                  }
                };

                const handleNext = () => {
                  if (currentIndex < totalQuestions - 1) {
                    setCurrentQuizIndex((prev) => ({
                      ...prev,
                      [quiz.id]: currentIndex + 1,
                    }));
                  }
                };

                if (totalQuestions === 0) {
                  if (isMainModuleQuiz && (sequence === 2 || sequence === 3)) {
                    return (
                      <Card key={quizItem.id}>
                        <CardContent className="py-8 text-center space-y-4">
                          <p className="text-muted-foreground">
                            Load the quiz to get started.
                          </p>
                          <Button
                            onClick={() =>
                              handleStartSupplementaryQuiz(quiz.id, sequence as 2 | 3)
                            }
                            disabled={startingSupplementary === `${quiz.id}:${sequence}`}
                          >
                            {startingSupplementary === `${quiz.id}:${sequence}` ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              `Start quiz ${sequence}`
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                }

                if (!currentQuestion) return null;

                const optionKeys = getOrderedOptionKeys(currentQuestion.options);
                const userAnswer = answers[currentQuestion.id];
                const radioValue =
                  userAnswer && optionKeys.includes(userAnswer) ? userAnswer : "";

                const quizSlotLabel = `Quiz ${sequence}`;

                return (
                  <div key={quizItem.id} className="space-y-4">
                    {isMainModuleQuiz && progress && (progress.unlockedQuiz2 || progress.unlockedQuiz3) && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={sequence === 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setActiveQuizSequence((prev) => ({ ...prev, [quiz.id]: 1 }));
                            resetQuizSession(quiz.id, 1);
                          }}
                        >
                          Quiz 1
                        </Button>
                        {progress.unlockedQuiz2 && (
                          <Button
                            variant={sequence === 2 ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (progress.hasQuiz2Set) {
                                handleRetakeQuiz(quiz.id, 2);
                              } else {
                                handleStartSupplementaryQuiz(quiz.id, 2);
                              }
                            }}
                            disabled={startingSupplementary === `${quiz.id}:2`}
                          >
                            Quiz 2
                          </Button>
                        )}
                        {progress.unlockedQuiz3 && (
                          <Button
                            variant={sequence === 3 ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (progress.hasQuiz3Set) {
                                handleRetakeQuiz(quiz.id, 3);
                              } else {
                                handleStartSupplementaryQuiz(quiz.id, 3);
                              }
                            }}
                            disabled={startingSupplementary === `${quiz.id}:3`}
                          >
                            Quiz 3
                          </Button>
                        )}
                      </div>
                    )}
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {isMainModuleQuiz ? quizSlotLabel : quiz.title}
                        </CardTitle>
                        <CardDescription>
                          {isMainModuleQuiz && sequence > 1
                            ? "10 questions tirées de la banque du chapitre · "
                            : ""}
                          Question {currentIndex + 1} / {totalQuestions} • Note de passage:{" "}
                          {quiz.passingScore}%
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <SanitizedHtmlBlock
                            html={currentQuestion.question}
                            className="text-lg"
                            plainClassName="font-semibold text-lg"
                          />
                          <RadioGroup
                            key={currentQuestion.id}
                            value={radioValue}
                            onValueChange={(value) =>
                              handleQuizAnswerChange(quiz.id, currentQuestion.id, value)
                            }
                            disabled={isSubmitted}
                          >
                            {optionKeys.map((key, keyIndex) => {
                              const optionValue = currentQuestion.options[key];
                              const optionLetter = getOptionLetter(key, keyIndex);
                              return (
                                <div key={key} className="flex items-start space-x-3 py-2">
                                  <RadioGroupItem value={key} id={`${currentQuestion.id}-${key}`} className="self-center" />
                                  <Label
                                    htmlFor={`${currentQuestion.id}-${key}`}
                                    className="flex-1 cursor-pointer leading-relaxed text-base"
                                  >
                                    <span className="font-medium">{optionLetter}:</span> {optionValue}
                                  </Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </div>

                        <div className="pt-4 border-t space-y-3">
                          <div className="text-sm text-muted-foreground text-center">
                            {Object.keys(answers).length} / {totalQuestions} répondues
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              variant="outline"
                              onClick={handlePrevious}
                              disabled={currentIndex === 0 || isSubmitted}
                              className="flex-1 sm:flex-initial"
                            >
                              <ChevronLeft className="h-4 w-4 mr-2" />
                              Previous
                            </Button>
                            {currentIndex < totalQuestions - 1 ? (
                              <Button
                                variant="outline"
                                onClick={handleNext}
                                disabled={isSubmitted}
                                className="flex-1 sm:flex-initial"
                              >
                                Next
                                <ChevronRight className="h-4 w-4 ml-2" />
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleSubmitQuiz(quizItem)}
                                disabled={isSubmitting || Object.keys(answers).length < totalQuestions}
                                className="flex-1 sm:flex-initial"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Soumission...
                                  </>
                                ) : (
                                  "Submit quiz"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isSubmitted && (
                          <div className="p-4 bg-muted rounded-lg space-y-3">
                            <p className="text-sm text-muted-foreground text-center">Quiz submitted</p>
                            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2">
                              <Button
                                variant="outline"
                                onClick={() => handleRetakeQuiz(quiz.id, sequence)}
                                size="sm"
                              >
                                Refaire le {quizSlotLabel.toLowerCase()}
                              </Button>
                              {isMainModuleQuiz && sequence === 1 && progress?.unlockedQuiz2 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartSupplementaryQuiz(quiz.id, 2)}
                                  disabled={startingSupplementary === `${quiz.id}:2`}
                                >
                                  {startingSupplementary === `${quiz.id}:2` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Start quiz 2"
                                  )}
                                </Button>
                              )}
                              {isMainModuleQuiz && sequence === 2 && progress?.unlockedQuiz3 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartSupplementaryQuiz(quiz.id, 3)}
                                  disabled={startingSupplementary === `${quiz.id}:3`}
                                >
                                  {startingSupplementary === `${quiz.id}:3` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Start quiz 3"
                                  )}
                                </Button>
                              )}
                            </div>
                            {isMainModuleQuiz && sequence === 1 && progress && !progress.unlockedQuiz2 && (
                              <p className="text-xs text-center text-muted-foreground">
                                Score at least {progress.passingScore}% on quiz 1 to unlock quiz 2.
                              </p>
                            )}
                            {isMainModuleQuiz && sequence === 2 && progress && !progress.unlockedQuiz3 && (
                              <p className="text-xs text-center text-muted-foreground">
                                Score at least {progress.passingScore}% on quiz 2 to unlock quiz 3.
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Previous Attempts Section */}
                    {quizAttempts[quiz.id] && quizAttempts[quiz.id].length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Previous attempts</CardTitle>
                          <CardDescription>
                            Your attempt history for this quiz
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loadingAttempts[quiz.id] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {quizAttempts[quiz.id].map((attempt, index) => {
                                const isPassed = attempt.passed ?? (attempt.score >= quiz.passingScore);
                                const formattedDate = new Intl.DateTimeFormat('fr-CA', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(attempt.completedAt);
                                const isExpanded = expandedAttemptId[quiz.id] === attempt.id;

                                return (
                                  <div key={attempt.id} className="space-y-3">
                                    <div
                                      className={`flex items-center justify-between p-3 rounded-lg border ${
                                        isPassed
                                          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                                          : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        {isPassed ? (
                                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        ) : (
                                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        )}
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold">
                                              {attempt.label ?? `Quiz ${attempt.quizSequence ?? 1} · Attempt 1`}
                                            </span>
                                            <Badge
                                              variant={isPassed ? 'default' : 'destructive'}
                                              className="text-xs"
                                            >
                                              {attempt.score}%
                                            </Badge>
                                            {isPassed && (
                                              <Badge variant="outline" className="text-xs border-green-600 text-green-700 dark:text-green-400">
                                                Passed
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {formattedDate}
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setExpandedAttemptId((prev) => ({
                                            ...prev,
                                            [quiz.id]: prev[quiz.id] === attempt.id ? null : attempt.id,
                                          }))
                                        }
                                      >
                                        {isExpanded ? "Hide" : "View answers"}
                                      </Button>
                                    </div>

                                    {isExpanded && (
                                      <div className="rounded-lg border bg-background p-4 space-y-4">
                                        {(
                                          (attempt.quizSequence ?? 1) > 1 && attempt.questionsSnapshot?.length
                                            ? attempt.questionsSnapshot
                                            : quiz.questions.map((q) => ({
                                                id: q.id,
                                                question: q.question,
                                                options: (q.options as Record<string, string>) || {},
                                                correctAnswer: q.correctAnswer,
                                                explanation: q.explanation,
                                              }))
                                        ).map((question, questionIndex) => {
                                          const options = question.options || {};
                                          const userAnswer = attempt.answers?.[question.id];
                                          const userDisplay = getAnswerDisplay(userAnswer, options);
                                          const correctDisplay = getAnswerDisplay(
                                            question.correctAnswer,
                                            options
                                          );
                                          const userIndex = resolveAnswerIndex(userAnswer, options);
                                          const correctIndex = resolveAnswerIndex(
                                            question.correctAnswer,
                                            options
                                          );
                                          const isCorrect =
                                            userIndex !== null &&
                                            correctIndex !== null &&
                                            userIndex === correctIndex;

                                          return (
                                            <div key={question.id} className="space-y-2">
                                              <div className="font-medium">{questionIndex + 1}.</div>
                                              <SanitizedHtmlBlock
                                                html={question.question}
                                                plainClassName="font-medium"
                                                className="text-sm"
                                              />
                                              <div className="text-sm">
                                                <span
                                                  className={`font-semibold ${isCorrect ? "text-green-600" : "text-red-600"}`}
                                                >
                                                  Votre réponse:
                                                </span>
                                                <span className="ml-2">{userDisplay.label}</span>
                                              </div>
                                              <div className="text-sm">
                                                <span className="font-semibold">Réponse correcte:</span>
                                                <span className="ml-2">{correctDisplay.label}</span>
                                              </div>
                                              {"explanation" in question && question.explanation && (
                                                <div className="text-sm text-muted-foreground mt-2">
                                                  <span className="font-semibold">Explication:</span>
                                                  <div className="mt-1">
                                                    <SanitizedHtmlBlock
                                                      html={question.explanation}
                                                      plainClassName="whitespace-pre-wrap"
                                                      className="prose-sm text-muted-foreground"
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Student Notes Panel - At the bottom */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Mes notes
            </CardTitle>
            <div className="flex items-center gap-2">
              {noteSaved && (
                <span className="text-xs text-muted-foreground">Sauvegardé</span>
              )}
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote}
                variant={noteSaved ? "outline" : "default"}
              >
                {savingNote ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-2" />
                    Sauvegarder
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={studentNote}
            onChange={(e) => setStudentNote(e.target.value)}
            placeholder="Take your notes here while studying this module..."
            className="min-h-[120px] resize-y"
            rows={5}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              Vos notes sont sauvegardées lorsque vous cliquez sur "Sauvegarder"
            </p>
            {studentNote.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {studentNote.length} caractère{studentNote.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
