"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getMockExamAttemptReviewAction } from "@/app/actions/exam-taking";
import { SanitizedHtmlBlock } from "@/components/ui/sanitized-html-block";
import { getAnswerDisplay, resolveAnswerIndex } from "@/lib/utils/quiz-answer-display";

export type ExamSubmittedAttemptSummary = {
  id: string;
  score: number;
  completedAt: Date;
  passed: boolean;
  canViewCorrections: boolean;
};

type ReviewQuestion = {
  id: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string | null;
};

type ReviewPayload = {
  score: number;
  passingScore: number;
  passed: boolean;
  canViewCorrections: boolean;
  userAnswers: Record<string, string>;
  questions: ReviewQuestion[];
};

interface ExamPastAttemptsSectionProps {
  passingScore: number;
  attempts: ExamSubmittedAttemptSummary[];
}

export function ExamPastAttemptsSection({ passingScore, attempts }: ExamPastAttemptsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, ReviewPayload>>({});

  if (attempts.length === 0) {
    return null;
  }

  const toggle = async (attemptId: string) => {
    if (expandedId === attemptId) {
      setExpandedId(null);
      return;
    }

    if (!cache[attemptId]) {
      setLoadingId(attemptId);
      try {
        const res = await getMockExamAttemptReviewAction(attemptId);
        if (res.success && res.data) {
          setCache((prev) => ({ ...prev, [attemptId]: res.data as ReviewPayload }));
          setExpandedId(attemptId);
        } else {
          toast.error(res.error || "Unable to load attempt");
        }
      } finally {
        setLoadingId(null);
      }
    } else {
      setExpandedId(attemptId);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Previous attempts</CardTitle>
        <CardDescription>Review your past mock exam attempts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {attempts.map((attempt, index) => {
          const isExpanded = expandedId === attempt.id;
          const review = cache[attempt.id];
          const formattedDate = new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(attempt.completedAt));

          return (
            <div key={attempt.id} className="space-y-3">
              <div
                className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border ${
                  attempt.passed
                    ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {attempt.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Attempt #{attempts.length - index}</span>
                      <Badge variant={attempt.passed ? "default" : "destructive"} className="text-xs">
                        {attempt.score}%
                      </Badge>
                      {attempt.passed && (
                        <Badge variant="outline" className="text-xs border-green-600 text-green-700 dark:text-green-400">
                          Passed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={loadingId === attempt.id}
                  onClick={() => void toggle(attempt.id)}
                >
                  {loadingId === attempt.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : isExpanded ? (
                    "Hide"
                  ) : (
                    "View answers"
                  )}
                </Button>
              </div>

              {isExpanded && review && (
                <div className="rounded-lg border bg-background p-4 space-y-4">
                  {!review.canViewCorrections && (
                    <p className="text-sm text-muted-foreground border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-md p-3">
                      Correct answers and explanations appear when you reach the passing score ({passingScore}
                      %) or when an admin grants access.
                    </p>
                  )}
                  {review.questions.map((question, questionIndex) => {
                    const options = question.options || {};
                    const userAnswer = review.userAnswers[question.id];
                    const userDisplay = getAnswerDisplay(userAnswer, options);
                    const correctDisplay = review.canViewCorrections
                      ? getAnswerDisplay(question.correctAnswer, options)
                      : { label: "—", value: null as string | null };
                    const userIndex = resolveAnswerIndex(userAnswer, options);
                    const correctIndex = review.canViewCorrections
                      ? resolveAnswerIndex(question.correctAnswer, options)
                      : null;
                    const isCorrect =
                      review.canViewCorrections &&
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
                            className={`font-semibold ${
                              !review.canViewCorrections
                                ? "text-foreground"
                                : isCorrect
                                  ? "text-green-600"
                                  : "text-red-600"
                            }`}
                          >
                            Your answer:
                          </span>
                          <span className="ml-2">{userDisplay.label}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">Correct answer:</span>
                          <span className="ml-2">{correctDisplay.label}</span>
                        </div>
                        {review.canViewCorrections && question.explanation && (
                          <div className="text-sm text-muted-foreground mt-2">
                            <span className="font-semibold">Explanation:</span>
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
      </CardContent>
    </Card>
  );
}
