"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { submitQuestionBankAnswerAction } from "@/app/actions/question-bank-practice";
import { useQuestionBankQuestions, useQuestionBankAttempts, useQuestionBankStats } from "@/lib/hooks/use-question-bank";
import { useQueryClient } from "@tanstack/react-query";

interface QuestionBankPracticeProps {
  courseId: string;
}

type Question = {
  id: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string | null;
  questionBankId: string;
  questionBankTitle: string;
};

type QuestionState = {
  answer: string;
  submitted: boolean;
  isCorrect: boolean | null;
};

export function QuestionBankPractice({ courseId }: QuestionBankPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const prevQuestionIdRef = useRef<string | null>(null);

  // Use React Query for questions, attempts, and stats
  const { data: questionsResult, isLoading: questionsLoading } = useQuestionBankQuestions(courseId);
  const { data: attemptsResult } = useQuestionBankAttempts(courseId);
  const { data: statsResult } = useQuestionBankStats(courseId);

  const questions = (questionsResult?.success && questionsResult.data) ? questionsResult.data : [];
  const loading = questionsLoading;

  const stats = useMemo(() => {
    if (statsResult?.success && statsResult.data) {
      return statsResult.data;
    }
    return {
      totalAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalQuestions: 0,
      score: 0,
    };
  }, [statsResult]);

  // Initialize question states from attempts (only once when questions/attempts load)
  useEffect(() => {
    if (questions.length > 0 && attemptsResult) {
      const states: Record<string, QuestionState> = {};
      questions.forEach((question) => {
        const attempt = attemptsResult.success && attemptsResult.data ? attemptsResult.data[question.id] : null;
        if (attempt) {
          states[question.id] = {
            answer: attempt.answer,
            submitted: attempt.submitted,
            isCorrect: attempt.isCorrect,
          };
        } else {
          states[question.id] = {
            answer: "",
            submitted: false,
            isCorrect: null,
          };
        }
      });
      setQuestionStates(states);
      // Initialize start time only once when first question loads
      if (startTime === null) {
        setStartTime(Date.now());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length, attemptsResult?.success]);

  // Update start time when navigating to a new unsubmitted question
  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length) {
      const currentQuestionId = questions[currentIndex]?.id;
      // Only reset timer if we've moved to a different question
      if (currentQuestionId && currentQuestionId !== prevQuestionIdRef.current) {
        const currentState = questionStates[currentQuestionId];
        // Only reset timer if question hasn't been submitted
        if (!currentState?.submitted) {
          setStartTime(Date.now());
        }
        prevQuestionIdRef.current = currentQuestionId;
      }
    }
    // Note: We intentionally don't include questionStates in deps to avoid loops
    // We only want to reset timer when currentIndex changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleSubmit = async () => {
    const currentQuestion = questions[currentIndex];
    const currentState = questionStates[currentQuestion.id];

    if (!currentState || !currentState.answer) {
      toast.error("Please select an answer");
      return;
    }

    if (currentState.submitted) return;

    setSubmitting(true);
    try {
      const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : undefined;

      const result = await submitQuestionBankAnswerAction(
        currentQuestion.questionBankId,
        currentQuestion.id,
        currentState.answer,
        timeSpent
      );

      if (result.success && result.data) {
        // Update question state
        setQuestionStates((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            ...prev[currentQuestion.id],
            submitted: true,
            isCorrect: result.data.isCorrect,
          },
        }));
        // Invalidate React Query cache for stats and attempts
        queryClient.invalidateQueries({ queryKey: ["question-bank-stats", courseId] });
        queryClient.invalidateQueries({ queryKey: ["question-bank-attempts", courseId] });
        setStartTime(null);
      } else {
        toast.error(result.error || "Error during submission");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Error during submission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (answer: string) => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    setQuestionStates((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        answer,
        // Don't change submitted state when just changing answer
      },
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleReset = () => {
    if (confirm("Do you want to reset all questions?")) {
      // Clear all question states
      const clearedStates: Record<string, QuestionState> = {};
      questions.forEach((question) => {
        clearedStates[question.id] = {
          answer: "",
          submitted: false,
          isCorrect: null,
        };
      });
      setQuestionStates(clearedStates);
      setCurrentIndex(0);
      setStartTime(Date.now());
      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ["question-bank-stats", courseId] });
      queryClient.invalidateQueries({ queryKey: ["question-bank-attempts", courseId] });
    }
  };

  // Memoize values BEFORE early returns to follow Rules of Hooks
  const currentQuestion = questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null;
  const currentState = useMemo(() => {
    if (!currentQuestion) {
      return {
        answer: "",
        submitted: false,
        isCorrect: null,
      };
    }
    return questionStates[currentQuestion.id] || {
      answer: "",
      submitted: false,
      isCorrect: null,
    };
  }, [questionStates, currentQuestion?.id]);
  const optionKeys = useMemo(() => {
    if (!currentQuestion?.options) return [];
    return Object.keys(currentQuestion.options).sort();
  }, [currentQuestion?.options]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune question disponible pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Question introuvable.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Count how many questions have been answered (submitted)
  const answeredCount = Object.values(questionStates).filter(
    (state) => state.submitted
  ).length;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-3 sm:flex sm:items-center sm:gap-6">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="text-sm text-muted-foreground">Questions répondues</div>
                <div className="text-lg font-semibold">
                  {answeredCount} / {questions.length}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="text-sm text-muted-foreground">Score cumulatif</div>
                <div className="text-lg font-semibold">{stats.score}%</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="text-sm text-muted-foreground">Réponses correctes</div>
                <div className="text-lg font-semibold text-green-600">
                  {stats.correctAnswers} / {stats.totalAttempts}
                </div>
              </div>
            </div>
            <Button className="w-full sm:w-auto" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser tout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
            <Badge variant="secondary">{currentQuestion.questionBankTitle}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-lg">{currentQuestion.question}</div>

          <RadioGroup
            value={currentState.answer}
            onValueChange={handleAnswerChange}
            disabled={currentState.submitted}
          >
            {optionKeys.map((key) => {
              const opts = currentQuestion.options;
              const optionsObj: Record<string, unknown> =
                opts && typeof opts === "object" && !Array.isArray(opts) ? (opts as any) : {};
              const rawOptionValue = optionsObj[key];
              const optionValue =
                typeof rawOptionValue === "string"
                  ? rawOptionValue
                  : rawOptionValue == null
                  ? ""
                  : String(rawOptionValue);
              const isSelected = currentState.answer === key;
              const isCorrectOption = key === currentQuestion.correctAnswer;
              const showFeedback = currentState.submitted && (isSelected || isCorrectOption);

              return (
                <div key={key} className="flex items-start space-x-3 py-2">
                  <RadioGroupItem
                    value={key}
                    id={key}
                    className={`self-center ${
                      showFeedback
                        ? isCorrectOption
                          ? "border-green-500"
                          : isSelected && !isCorrectOption
                          ? "border-red-500"
                          : ""
                        : ""
                    }`}
                  />
                  <Label
                    htmlFor={key}
                    className={`flex-1 cursor-pointer leading-relaxed text-base ${
                      showFeedback
                        ? isCorrectOption
                          ? "text-green-600 font-semibold"
                          : isSelected && !isCorrectOption
                          ? "text-red-600"
                          : ""
                        : ""
                    }`}
                  >
                    <span className="font-medium">{key}:</span> {optionValue}
                    {showFeedback && isCorrectOption && (
                      <CheckCircle2 className="inline h-4 w-4 ml-2 text-green-600" />
                    )}
                    {showFeedback && isSelected && !isCorrectOption && (
                      <XCircle className="inline h-4 w-4 ml-2 text-red-600" />
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {currentState.submitted && currentQuestion.explanation && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-semibold mb-2">Explication:</div>
              <div className="text-sm whitespace-pre-wrap">{currentQuestion.explanation}</div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>

            {!currentState.submitted ? (
              <Button onClick={handleSubmit} disabled={!currentState.answer || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Soumettre"
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={currentIndex === questions.length - 1}>
                Suivant
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

