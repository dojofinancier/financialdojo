"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Target, RotateCcw, ArrowLeft, Eye } from "lucide-react";
import { revealCaseStudyAnswersAction } from "@/app/actions/case-studies";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CaseStudyResultsProps {
  result: {
    attemptId?: string;
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
  caseStudy: {
    id: string;
    caseNumber: number;
    title: string;
    theme: string | null;
  };
  onRetake: () => void;
  onExit: () => void;
}

export function CaseStudyResults({ result, caseStudy, onRetake, onExit }: CaseStudyResultsProps) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  // Helper function to map option keys to letters
  const getOptionLetter = (key: string, index: number): string => {
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  const handleRevealAnswers = async () => {
    if (!result.attemptId) {
      // If no attemptId, just show answers (shouldn't happen, but handle gracefully)
      setShowAnswers(true);
      return;
    }

    setLoadingAnswers(true);
    try {
      const revealResult = await revealCaseStudyAnswersAction(result.attemptId);
      if (revealResult.success) {
        setShowAnswers(true);
      } else {
        toast.error(revealResult.error || "Error while revealing answers");
      }
    } catch (error) {
      console.error("Error revealing answers:", error);
      toast.error("Error while revealing answers");
    } finally {
      setLoadingAnswers(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Résultats de l'étude de cas</CardTitle>
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
                    Réussi
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 mr-2" />
                    Échoué
                  </>
                )}
              </Badge>
            </div>
            <div className="text-muted-foreground">
              {result.correctAnswers} / {result.totalQuestions} questions correctes
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Note de passage: {result.passingScore}%
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            {!showAnswers && (
              <Button size="lg" onClick={handleRevealAnswers} disabled={loadingAnswers}>
                {loadingAnswers ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <Eye className="h-5 w-5 mr-2" />
                    Révéler les réponses
                  </>
                )}
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={onRetake}>
              <RotateCcw className="h-5 w-5 mr-2" />
              Réessayer
            </Button>
            <Button size="lg" variant="outline" onClick={onExit}>
              <ArrowLeft className="h-5 w-5 mr-2" />
              Retour aux études de cas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Answers Review */}
      {showAnswers && (
        <Card>
          <CardHeader>
            <CardTitle>Corrections</CardTitle>
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
                              <span className="text-xs text-muted-foreground ml-2">(Votre réponse)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {question.explanation && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="text-sm font-semibold mb-1">Explication:</div>
                      <div className="text-sm whitespace-pre-wrap">{question.explanation}</div>
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
