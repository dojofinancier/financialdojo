"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FileText, CheckCircle2, XCircle, ArrowLeft, Video as VideoIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { getModuleContentAction } from "@/app/actions/module-content";
import { markModuleAsLearnedAction } from "@/app/actions/study-plan";
import { submitQuizAttemptAction, getQuizAttemptsAction } from "@/app/actions/quizzes";
import { getStudentModuleNoteAction, saveStudentModuleNoteAction } from "@/app/actions/student-notes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, StickyNote, Save } from "lucide-react";

interface ModuleDetailPageProps {
  courseId: string;
  moduleId: string;
  onBack: () => void;
  componentVisibility?: {
    videos?: boolean;
    quizzes?: boolean;
    notes?: boolean;
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
    }>;
  };
};

export function ModuleDetailPage({ courseId, moduleId, onBack, componentVisibility }: ModuleDetailPageProps) {
  // Get component visibility settings (default to enabled if not set)
  const videosEnabled = componentVisibility?.videos !== false; // Default to true if not set
  const quizzesEnabled = componentVisibility?.quizzes !== false; // Default to true if not set
  const notesEnabled = componentVisibility?.notes !== false; // Default to true if not set

  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [progress, setProgress] = useState<any>(null);

  // Determine initial tab based on what's enabled and available
  const getInitialTab = (): "videos" | "notes" | "quiz" => {
    // Only show videos tab if enabled AND there are videos
    if (videosEnabled && videos.length > 0) return "videos";
    if (notesEnabled) return "notes";
    if (quizzesEnabled) return "quiz";
    return "notes"; // Fallback
  };

  const [activeTab, setActiveTab] = useState<"videos" | "notes" | "quiz">(getInitialTab());
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
  }>>>({});
  const [loadingAttempts, setLoadingAttempts] = useState<Record<string, boolean>>({});

  // Update active tab if videos tab is selected but there are no videos
  useEffect(() => {
    if (activeTab === "videos" && (!videosEnabled || videos.length === 0)) {
      // Switch to first available tab
      if (notesEnabled) {
        setActiveTab("notes");
      } else if (quizzesEnabled) {
        setActiveTab("quiz");
      }
    }
  }, [activeTab, videosEnabled, videos.length, notesEnabled, quizzesEnabled]);

  const loadStudentNote = useCallback(async () => {
    try {
      const result = await getStudentModuleNoteAction(moduleId);
      if (result.success && result.data) {
        setStudentNote(result.data.content || "");
        setNoteSaved(result.data.exists);
      }
    } catch (error) {
      console.error("Error loading student note:", error);
    }
  }, [moduleId]);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      const result = await saveStudentModuleNoteAction(moduleId, studentNote);
      if (result.success) {
        setNoteSaved(true);
        toast.success("Note saved");
        // Reset the saved indicator after 2 seconds
        setTimeout(() => setNoteSaved(false), 2000);
      } else {
        toast.error(result.error || "Error saving");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Error saving");
    } finally {
      setSavingNote(false);
    }
  };

  const loadModuleContent = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getModuleContentAction(moduleId);
      if (result.success && result.data) {
        setModule(result.data.module);
        setVideos(result.data.videos);
        setNotes(result.data.notes);
        setQuizzes(result.data.quizzes);
        setProgress(result.data.progress);
      } else {
        toast.error(result.error || "Error loading the module");
      }
    } catch (error) {
      console.error("Error loading module content:", error);
      toast.error("Error loading the module");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    loadModuleContent();
    loadStudentNote();

    // Check URL parameters for tab
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "videos" || tab === "notes" || tab === "quiz") {
      setActiveTab(tab);
    }
  }, [loadModuleContent, loadStudentNote]);


  const loadQuizAttempts = useCallback(async () => {
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
          }));
        }
      });

      setQuizAttempts(attemptsMap);
    } catch (error) {
      console.error("Error loading quiz attempts:", error);
    }
  }, [quizzes]);

  // Load quiz attempts when quizzes are loaded
  useEffect(() => {
    if (quizzes.length > 0) {
      loadQuizAttempts();
    }
  }, [loadQuizAttempts, quizzes.length]);

  const handleRetakeQuiz = (quizId: string) => {
    // Reset the quiz state to allow retaking
    setQuizSubmitted((prev) => ({
      ...prev,
      [quizId]: false,
    }));
    setQuizAnswers((prev) => ({
      ...prev,
      [quizId]: {},
    }));
    setCurrentQuizIndex((prev) => ({
      ...prev,
      [quizId]: 0,
    }));
  };

  const handleMarkAsComplete = async () => {
    if (!confirm("Do you want to mark this module as completed?")) {
      return;
    }

    setMarkingComplete(true);
    try {
      const result = await markModuleAsLearnedAction(courseId, moduleId);
      if (result.success) {
        toast.success("Module marked as completed!");
        await loadModuleContent(); // Reload to update progress
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      console.error("Error marking module as complete:", error);
      toast.error("Error updating");
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleDownloadNotePdf = (noteItem: Note) => {
    const title = `${module?.title || "Note"} - Note ${noteItem.order + 1}`;
    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: "Inter", Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 20px; margin-bottom: 16px; }
      .note-content { line-height: 1.75; }
      .note-content p { margin: 0 0 16px 0; }
      .note-content h1 { font-size: 24px; margin: 24px 0 16px; }
      .note-content h2 { font-size: 20px; margin: 20px 0 12px; }
      .note-content h3 { font-size: 18px; margin: 16px 0 10px; }
      .note-content ul, .note-content ol { margin: 16px 0; padding-left: 24px; }
      .note-content li { margin-bottom: 8px; }
      @media print { body { margin: 0.5in; } }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="note-content">${noteItem.note.content}</div>
  </body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.srcdoc = html;

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) return;
      printWindow.focus();
      printWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    };

    document.body.appendChild(iframe);
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

  const handleSubmitQuiz = async (quiz: Quiz) => {
    if (!quizAnswers[quiz.quiz.id] || Object.keys(quizAnswers[quiz.quiz.id]).length === 0) {
      toast.error("Please answer all questions");
      return;
    }

    // Check if all questions are answered
    const allAnswered = quiz.quiz.questions.every(
      (q) => quizAnswers[quiz.quiz.id]?.[q.id]
    );
    if (!allAnswered) {
      toast.error("Please answer all questions");
      return;
    }

    setSubmittingQuiz(quiz.quiz.id);
    try {
      const result = await submitQuizAttemptAction({
        quizId: quiz.quiz.id,
        answers: quizAnswers[quiz.quiz.id],
        timeSpent: 0, // Phase 1 quizzes don't track time
      });

      if (result.success && result.data) {
        setQuizSubmitted((prev) => ({ ...prev, [quiz.quiz.id]: true }));
        if (result.data.passed) {
          toast.success(`Quiz passed! Score: ${result.data.score}%`);
        } else {
          toast.warning(`Score: ${result.data.score}%. Passing score: ${quiz.quiz.passingScore}%`);
        }
        // Reload attempts to show the new submission
        await loadQuizAttempts();
      } else {
        toast.error(result.error || "Error during submission");
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Error during submission");
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

  // Helper function to map option keys to letters
  const getOptionLetter = (key: string, index: number): string => {
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    return String.fromCharCode(65 + index);
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
            Back
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
              Completed
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
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as completed
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className={`grid w-full ${videosEnabled && videos.length > 0 && quizzesEnabled && notesEnabled ? 'grid-cols-3' : videosEnabled && videos.length > 0 && quizzesEnabled ? 'grid-cols-2' : videosEnabled && videos.length > 0 && notesEnabled ? 'grid-cols-2' : quizzesEnabled && notesEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {videosEnabled && videos.length > 0 && (
            <TabsTrigger value="videos">
              <VideoIcon className="h-4 w-4 mr-2" />
              Videos
            </TabsTrigger>
          )}
          {notesEnabled && (
            <TabsTrigger value="notes">
              <FileText className="h-4 w-4 mr-2" />
              Course notes
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
                          title={`Video ${videoItem.order}`}
                        />
                      </div>
                      {videoItem.video.transcript && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="text-sm font-semibold mb-2">Transcript:</div>
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
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No notes available for this module.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notes.map((noteItem) => (
                <Card key={noteItem.id}>
                  <CardHeader className="flex flex-row items-center justify-end gap-3">
                    <Button
                      variant="outline"
                      className="hidden md:inline-flex"
                      onClick={() => handleDownloadNotePdf(noteItem)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="note-content [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:my-4 [&>ol]:my-4 [&>li]:mb-2 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-6 [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-4 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-3 [&>strong]:font-semibold [&>em]:italic [&>a]:text-primary [&>a]:underline [&>a:hover]:no-underline [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>li]:ml-4"
                      style={{
                        lineHeight: '1.75',
                      }}
                      dangerouslySetInnerHTML={{ __html: noteItem.note.content }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

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
              {quizzes.map((quizItem) => {
                const quiz = quizItem.quiz;
                const isSubmitted = quizSubmitted[quiz.id];
                const isSubmitting = submittingQuiz === quiz.id;
                const answers = quizAnswers[quiz.id] || {};
                const currentIndex = currentQuizIndex[quiz.id] || 0;
                const currentQuestion = quiz.questions[currentIndex];
                const totalQuestions = quiz.questions.length;

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

                if (!currentQuestion) return null;

                const optionKeys = currentQuestion.options
                  ? Object.keys(currentQuestion.options).sort()
                  : [];
                const userAnswer = answers[currentQuestion.id];

                return (
                  <div key={quizItem.id} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>{quiz.title}</CardTitle>
                        <CardDescription>
                          Question {currentIndex + 1} / {totalQuestions} • Passing score: {quiz.passingScore}%
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <div className="font-semibold text-lg">
                            {currentQuestion.question}
                          </div>
                          <RadioGroup
                            value={userAnswer || ""}
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
                            {Object.keys(answers).length} / {totalQuestions} answered
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
                                    Submitting...
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
                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                onClick={() => handleRetakeQuiz(quiz.id)}
                                size="sm"
                              >
                                Retake quiz
                              </Button>
                            </div>
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
                            History of your attempts for this quiz
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
                                const formattedDate = new Intl.DateTimeFormat('en-CA', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(attempt.completedAt);

                                return (
                                  <div
                                    key={attempt.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${isPassed
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
                                            Attempt #{quizAttempts[quiz.id].length - index}
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
              My notes
            </CardTitle>
            <div className="flex items-center gap-2">
              {noteSaved && (
                <span className="text-xs text-muted-foreground">Saved</span>
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
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-2" />
                    Save
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
            placeholder="Take your notes here while you study this module..."
            className="min-h-[120px] resize-y"
            rows={5}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              Your notes are saved when you click "Save"
            </p>
            {studentNote.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {studentNote.length} character{studentNote.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
