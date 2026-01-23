"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Clock, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  getExamForTakingAction,
  saveExamAnswersAction,
  submitExamAction,
} from "@/app/actions/exam-taking";
import { ExamResults } from "./exam-results";

interface ExamPlayerProps {
  examId: string;
  onExit: () => void;
}

type Question = {
  id: string;
  order: number;
  question: string;
  options: Record<string, string>;
  type: string;
};

type Exam = {
  id: string;
  title: string;
  timeLimit: number | null;
  passingScore: number;
  examFormat: string | null;
  questions: Question[];
};

const STORAGE_KEY_PREFIX = "exam_";
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

function normalizeQuestionOptions(value: unknown): Record<string, string> {
  const toRecord = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const obj = v as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, raw] of Object.entries(obj)) {
      if (raw == null) continue;
      out[k] = typeof raw === "string" ? raw : String(raw);
    }
    return out;
  };

  if (typeof value === "string") {
    try {
      return toRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return toRecord(value);
}

export function ExamPlayer({ examId, onExit }: ExamPlayerProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const timeRemainingRef = useRef<number | null>(null);
  const currentQuestionIndexRef = useRef<number>(0);
  const examRef = useRef<Exam | null>(null);
  const submittedRef = useRef(false);
  const handleTimeUpRef = useRef<() => void>(() => {});

  const storageKey = `${STORAGE_KEY_PREFIX}${examId}`;

  // Keep refs in sync with state
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  const startTimer = useCallback((initialTime: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timeRemainingRef.current = initialTime;

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          timeRemainingRef.current = 0;
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              answers: answersRef.current,
              timeRemaining: 0,
              currentQuestionIndex: currentQuestionIndexRef.current,
            })
          );
          handleTimeUpRef.current();
          return 0;
        }

        const newTime = prev - 1;
        timeRemainingRef.current = newTime;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            answers: answersRef.current,
            timeRemaining: newTime,
            currentQuestionIndex: currentQuestionIndexRef.current,
          })
        );
        return newTime;
      });
    }, 1000);
  }, [storageKey]);

  const startAutoSave = useCallback((examId: string, initialAnswers: Record<string, string>) => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    autoSaveIntervalRef.current = setInterval(async () => {
      const currentExam = examRef.current;
      if (currentExam && !submittedRef.current) {
        const timeSpent = currentExam.timeLimit
          ? currentExam.timeLimit - (timeRemainingRef.current || 0)
          : undefined;

        await saveExamAnswersAction(examId, answersRef.current, timeSpent || 0);

        // Also save to localStorage (including current question index)
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            answers: answersRef.current,
            timeRemaining: timeRemainingRef.current,
            currentQuestionIndex: currentQuestionIndexRef.current,
          })
        );
      }
    }, AUTO_SAVE_INTERVAL);
  }, [storageKey]);

  const loadExam = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getExamForTakingAction(examId);
      if (result.success && result.data) {
        const examData = result.data.exam as any;
        const normalizedExam: Exam = {
          ...examData,
          questions: Array.isArray(examData.questions)
            ? examData.questions.map((q: any) => ({
                ...q,
                options: normalizeQuestionOptions(q.options),
              }))
            : [],
        };
        setExam(normalizedExam);

        // Restore answers from localStorage or in-progress attempt
        const savedState = localStorage.getItem(storageKey);
        let restoredAnswers: Record<string, string> = {};
        let restoredTimeRemaining: number | null = null;
        let restoredQuestionIndex: number = 0;

        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            restoredAnswers = parsed.answers || {};
            restoredTimeRemaining = parsed.timeRemaining || null;
            restoredQuestionIndex = parsed.currentQuestionIndex !== undefined ? parsed.currentQuestionIndex : 0;
          } catch (e) {
            console.error("Error parsing saved state:", e);
          }
        }

        // If there's an in-progress attempt, use those answers
        if (result.data.inProgressAttempt) {
          restoredAnswers = {
            ...restoredAnswers,
            ...(result.data.inProgressAttempt.answers as Record<string, string>),
          };
        }

        setAnswers(restoredAnswers);
        answersRef.current = restoredAnswers;
        
        // Restore question index (ensure it's within bounds)
        const validIndex = Math.max(0, Math.min(restoredQuestionIndex, normalizedExam.questions.length - 1));
        setCurrentQuestionIndex(validIndex);
        currentQuestionIndexRef.current = validIndex;

        // Initialize timer
        if (normalizedExam.timeLimit) {
          const savedStartTime = localStorage.getItem(`${storageKey}_startTime`);
          const now = Date.now();

          if (savedStartTime && restoredTimeRemaining !== null) {
            // Resume timer
            const elapsed = Math.floor((now - parseInt(savedStartTime)) / 1000);
            const remaining = Math.max(0, restoredTimeRemaining - elapsed);
            setTimeRemaining(remaining);
            timeRemainingRef.current = remaining;
            startTimer(remaining);
          } else {
            // Start new timer
            const totalSeconds = normalizedExam.timeLimit;
            setTimeRemaining(totalSeconds);
            timeRemainingRef.current = totalSeconds;
            localStorage.setItem(`${storageKey}_startTime`, now.toString());
            startTimer(totalSeconds);
          }
        }

        // Start auto-save
        startAutoSave(normalizedExam.id, restoredAnswers);
      } else {
        toast.error(result.error || "Error loading the exam");
        onExit();
      }
    } catch (error) {
      console.error("Error loading exam:", error);
      toast.error("Error loading the exam");
      onExit();
    } finally {
      setLoading(false);
    }
  }, [examId, storageKey, onExit, startAutoSave, startTimer]);

  // Load exam and restore state
  useEffect(() => {
    loadExam();
    return () => {
      // Cleanup intervals
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [loadExam]);

  const handleSubmit = useCallback(async (isTimeUp: boolean = false) => {
    if (submitting || submitted) return;

    setSubmitting(true);
    try {
      const timeSpent = exam?.timeLimit
        ? exam.timeLimit - (timeRemaining || 0)
        : 0;

      const result = await submitExamAction(examId, answers, timeSpent);

      if (result.success && result.data) {
        setSubmitted(true);
        setResult(result.data);

        // Clear localStorage (exam is complete)
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}_startTime`);

        // Stop timers
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }

        if (!isTimeUp) {
          toast.success("Exam submitted successfully!");
        }
      } else {
        toast.error(result.error || "Error during submission");
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      toast.error("Error during submission");
    } finally {
      setSubmitting(false);
    }
  }, [answers, exam, examId, storageKey, submitted, submitting, timeRemaining]);

  const handleTimeUp = useCallback(async () => {
    if (submitted || submitting) return;

    toast.warning("Time is up. The exam is being submitted...");
    await handleSubmit(true);
  }, [handleSubmit, submitted, submitting]);

  useEffect(() => {
    handleTimeUpRef.current = handleTimeUp;
  }, [handleTimeUp]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    answersRef.current = newAnswers;

    // Save to localStorage immediately (including current question index)
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        answers: newAnswers,
        timeRemaining: timeRemainingRef.current,
        currentQuestionIndex: currentQuestionIndexRef.current,
      })
    );
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exam) {
    return null;
  }

  if (submitted && result) {
    return (
      <ExamResults
        result={result}
        exam={exam}
        onRetake={() => {
          // Clear state and reload
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`${storageKey}_startTime`);
          setSubmitted(false);
          setResult(null);
          setShowResults(false);
          loadExam();
        }}
        onExit={onExit}
      />
    );
  }

  // Helper function to map option keys to letters (option1 -> A, option2 -> B, etc.)
  const getOptionLetter = (key: string, index: number): string => {
    // If already a letter, return it
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    // Map option1, option2, etc. to A, B, C, D
    return String.fromCharCode(65 + index); // 65 is 'A' in ASCII
  };

  const currentQuestion = exam.questions[currentQuestionIndex];
  const optionKeys = currentQuestion.options
    ? Object.keys(currentQuestion.options).sort()
    : [];
  const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      {/* Header with timer and progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Exam in progress</div>
              <div className="text-lg font-semibold">{exam.title}</div>
            </div>
            <div className="flex items-center gap-6">
              {exam.timeLimit && timeRemaining !== null && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Time remaining</div>
                  <div
                    className={`text-lg font-semibold flex items-center gap-2 ${
                      timeRemaining < 300 ? "text-red-600" : ""
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              )}
              <div className="text-right">
                 <div className="text-sm text-muted-foreground">Progress</div>
                <div className="text-lg font-semibold">
                  {currentQuestionIndex + 1} / {exam.questions.length}
                </div>
              </div>
              <div className="text-right">
                 <div className="text-sm text-muted-foreground">Answered</div>
                <div className="text-lg font-semibold">
                  {answeredCount} / {exam.questions.length}
                </div>
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Question {currentQuestionIndex + 1} of {exam.questions.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-lg">{currentQuestion.question}</div>

          <RadioGroup
            value={answers[currentQuestion.id] || ""}
            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
          >
            {optionKeys.map((key, index) => {
              const optionValue = currentQuestion.options[key];
              const optionLetter = getOptionLetter(key, index);
              return (
                <div key={key} className="flex items-start space-x-3 py-2">
                  <RadioGroupItem value={key} id={key} className="self-center" />
                  <Label htmlFor={key} className="flex-1 cursor-pointer leading-relaxed text-base">

                    <span className="font-medium">{optionLetter}:</span> {optionValue}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  const newIndex = currentQuestionIndex - 1;
                  setCurrentQuestionIndex(newIndex);
                  currentQuestionIndexRef.current = newIndex;
                  // Save current question index
                  localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                      answers: answersRef.current,
                      timeRemaining: timeRemainingRef.current,
                      currentQuestionIndex: newIndex,
                    })
                  );
                }
              }}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onExit}>
                Exit
              </Button>
              {currentQuestionIndex < exam.questions.length - 1 ? (
                <Button
                  onClick={() => {
                    const newIndex = currentQuestionIndex + 1;
                    setCurrentQuestionIndex(newIndex);
                    currentQuestionIndexRef.current = newIndex;
                    // Save current question index
                    localStorage.setItem(
                      storageKey,
                      JSON.stringify({
                        answers: answersRef.current,
                        timeRemaining: timeRemainingRef.current,
                        currentQuestionIndex: newIndex,
                      })
                    );
                  }}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => handleSubmit()} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit exam"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

