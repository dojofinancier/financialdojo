"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Target, RotateCcw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ExamResultsProps {
  result: {
    score: number;
    passingScore: number;
    passed: boolean;
    correctAnswers: number;
    totalQuestions: number;
    userAnswers: Record<string, string>;
    questions: Array<{
      id: string;
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string | null;
    }>;
  };
  exam: {
    id: string;
    title: string;
    timeLimit: number | null;
    passingScore: number;
  };
  onRetake: () => void;
  onExit: () => void;
}

export function ExamResults({ result, exam, onRetake, onExit }: ExamResultsProps) {
  const [showAnswers, setShowAnswers] = useState(false);

  // Helper function to map option keys to letters (option1 -> A, option2 -> B, etc.)
  const getOptionLetter = (key: string, index: number): string => {
    // If already a letter, return it
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    // Map option1, option2, etc. to A, B, C, D
    return String.fromCharCode(65 + index); // 65 is 'A' in ASCII
  };

  const shouldEncourageRetry = result.score < exam.passingScore;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Exam results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold">{result.score}%</div>
            <div className="flex items-center justify-center gap-2">
              <Badge
                variant={result.passed ? "default" : "destructive"}
                className="text-lg px-4 py-2"
              >
                {result.passed ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Passed
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 mr-2" />
                    Failed
                  </>
                )}
              </Badge>
            </div>
            <div className="text-muted-foreground">
              {result.correctAnswers} / {result.totalQuestions} correct questions
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Passing score: {exam.passingScore}%
            </div>
          </div>

          {/* Encouragement Message */}
          {shouldEncourageRetry && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-yellow-900 mb-1">
                      Keep practicing!
                    </div>
                    <div className="text-sm text-yellow-800">
                      Your score is below {exam.passingScore}%. We encourage you to retake the exam
                      to improve your understanding before reviewing the answers.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            {shouldEncourageRetry ? (
              <Button size="lg" onClick={onRetake}>
                <RotateCcw className="h-5 w-5 mr-2" />
                Retry exam
              </Button>
            ) : (
              <>
                {!showAnswers && (
                  <Button size="lg" onClick={() => setShowAnswers(true)}>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    View answers
                  </Button>
                )}
                <Button size="lg" variant="outline" onClick={onRetake}>
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Retake exam
                </Button>
              </>
            )}
            <Button size="lg" variant="outline" onClick={onExit}>
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to exams
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Answers Review */}
      {showAnswers && !shouldEncourageRetry && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.questions.map((question, index) => {
              const userAnswer = result.userAnswers[question.id];
              const optionKeys = question.options ? Object.keys(question.options).sort() : [];
              const correctOptionKey = question.correctAnswer;
              const isUserCorrect = userAnswer && userAnswer.trim().toLowerCase() === correctOptionKey.trim().toLowerCase();

              return (
                <div key={question.id} className="border-b pb-6 last:border-0">
                  <div className="font-semibold mb-3">
                    Question {index + 1}: {question.question}
                  </div>
                  <div className="space-y-2">
                    {optionKeys.map((key, keyIndex) => {
                      const optionValue = question.options[key];
                      const isCorrect = key === correctOptionKey;
                      const isUserAnswer = userAnswer && userAnswer.trim().toLowerCase() === key.trim().toLowerCase();
                      const optionLetter = getOptionLetter(key, keyIndex);

                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect
                              ? "bg-green-50 border-green-500"
                              : isUserAnswer && !isCorrect
                              ? "bg-red-50 border-red-500"
                              : "bg-muted border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{optionLetter}:</span>
                            <span>{optionValue}</span>
                            {isCorrect && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                            )}
                            {isUserAnswer && !isCorrect && (
                              <XCircle className="h-4 w-4 text-red-600 ml-auto" />
                            )}
                            {isUserAnswer && (
                               <span className="text-xs text-muted-foreground ml-2">(Your answer)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {question.explanation && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="text-sm font-semibold mb-1">Explanation:</div>
                      <div className="text-sm">{question.explanation}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

