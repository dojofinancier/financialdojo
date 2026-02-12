"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { getCourseModulesAction } from "@/app/actions/modules";
import { getModuleContentAction } from "@/app/actions/module-content";
import { submitQuizAttemptAction } from "@/app/actions/quizzes";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuizItem {
  id: string;
  order: number;
  moduleTitle: string;
  moduleOrder: number;
  quiz: {
    id: string;
    title: string;
    passingScore: number;
    questions: Array<{
      id: string;
      order: number;
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
    }>;
  };
}

interface QuizzesToolProps {
  courseId: string;
  onBack: () => void;
}

export function QuizzesTool({ courseId, onBack }: QuizzesToolProps) {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, string>>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<Record<string, number>>({});

  const loadAllQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const modules = await getCourseModulesAction(courseId);
      const allQuizzes: QuizItem[] = [];

      for (const moduleRecord of modules) {
        try {
          const result = await getModuleContentAction(moduleRecord.id);
          if (result.success && result.data && result.data.quizzes) {
            for (const quizItem of result.data.quizzes) {
              allQuizzes.push({
                id: quizItem.id,
                order: quizItem.order,
                moduleTitle: result.data.module.title,
                moduleOrder: result.data.module.order,
                quiz: quizItem.quiz,
              });
              // Initialize question index
              setCurrentQuestionIndex((prev) => ({
                ...prev,
                [quizItem.id]: 0,
              }));
            }
          }
        } catch (error) {
          console.error(`Error loading quizzes for module ${moduleRecord.id}:`, error);
        }
      }

      // Sort by module order, then by quiz order
      allQuizzes.sort((a, b) => {
        if (a.moduleOrder !== b.moduleOrder) {
          return a.moduleOrder - b.moduleOrder;
        }
        return a.order - b.order;
      });

      setQuizzes(allQuizzes);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAllQuizzes();
  }, [loadAllQuizzes]);

  const getOptionLetter = (key: string, index: number): string => {
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    return String.fromCharCode(65 + index);
  };

  const handleSubmitQuiz = async (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    setSubmittingQuiz(quizId);
    try {
      const answers = quizAnswers[quizId] || {};
      const result = await submitQuizAttemptAction({ quizId: quiz.quiz.id, answers });
      if (result.success) {
        setQuizSubmitted((prev) => ({ ...prev, [quizId]: true }));
        toast.success(`Quiz submitted! Score: ${result.data?.score || 0}%`);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading quizzes...</p>
        </CardContent>
      </Card>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No quizzes available for this course.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuiz = quizzes[currentIndex];
  const questionIndex = currentQuestionIndex[currentQuiz.id] || 0;
  const currentQuestion = currentQuiz.quiz.questions[questionIndex];
  const totalQuestions = currentQuiz.quiz.questions.length;
  const isSubmitted = quizSubmitted[currentQuiz.id];
  const answers = quizAnswers[currentQuiz.id] || {};
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-sm text-muted-foreground">
          Quiz {currentIndex + 1} / {quizzes.length}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {currentQuiz.moduleTitle} - {currentQuiz.quiz.title || `Quiz ${currentQuiz.order}`}
          </CardTitle>
          <div className="text-sm text-muted-foreground mt-2">
            Question {questionIndex + 1} / {totalQuestions} • Answered: {answeredCount} / {totalQuestions}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSubmitted ? (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">{currentQuestion.question}</Label>
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => {
                      setQuizAnswers((prev) => ({
                        ...prev,
                        [currentQuiz.id]: {
                          ...(prev[currentQuiz.id] || {}),
                          [currentQuestion.id]: value,
                        },
                      }));
                    }}
                    className="mt-4"
                  >
                    {Object.entries(currentQuestion.options).map(([key, option], idx) => (
                      <div key={key} className="flex items-center space-x-2">
                        <RadioGroupItem value={key} id={`option-${key}`} />
                        <Label
                          htmlFor={`option-${key}`}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          <span className="font-semibold mr-2">{getOptionLetter(key, idx)}.</span>
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (questionIndex > 0) {
                        setCurrentQuestionIndex((prev) => ({
                          ...prev,
                          [currentQuiz.id]: questionIndex - 1,
                        }));
                      }
                    }}
                    disabled={questionIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  {questionIndex === totalQuestions - 1 ? (
                    <Button
                      onClick={() => handleSubmitQuiz(currentQuiz.id)}
                      disabled={submittingQuiz === currentQuiz.id}
                    >
                      {submittingQuiz === currentQuiz.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit quiz"
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentQuestionIndex((prev) => ({
                          ...prev,
                          [currentQuiz.id]: questionIndex + 1,
                        }));
                      }}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg font-semibold mb-2">Quiz submitted</p>
              <p className="text-muted-foreground mb-4">
                You answered {answeredCount} question{answeredCount > 1 ? "s" : ""} out of {totalQuestions}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuizSubmitted((prev) => ({ ...prev, [currentQuiz.id]: false }));
                  setQuizAnswers((prev) => ({
                    ...prev,
                    [currentQuiz.id]: {},
                  }));
                  setCurrentQuestionIndex((prev) => ({
                    ...prev,
                    [currentQuiz.id]: 0,
                  }));
                }}
              >
                Try again
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous quiz
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(Math.min(quizzes.length - 1, currentIndex + 1))}
              disabled={currentIndex === quizzes.length - 1}
            >
              Next quiz
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

