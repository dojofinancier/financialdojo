"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Target, RotateCcw, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SanitizedHtmlBlock } from "@/components/ui/sanitized-html-block";
import { getExamCorrectionsAction } from "@/app/actions/exam-taking";

export type ExamResultQuestion = {
  id: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string | null;
};

interface ExamResultsProps {
  result: {
    attemptId: string;
    score: number;
    passingScore: number;
    passed: boolean;
    correctAnswers: number;
    totalQuestions: number;
    userAnswers: Record<string, string>;
    canViewCorrections: boolean;
    questions?: ExamResultQuestion[];
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
  const [loadedQuestions, setLoadedQuestions] = useState<ExamResultQuestion[] | null>(null);
  const [loadingCorrections, setLoadingCorrections] = useState(false);

  const questionsForReview = loadedQuestions ?? result.questions ?? [];
  const belowPassing = result.score < exam.passingScore;

  const getOptionLetter = (key: string, index: number): string => {
    if (/^[A-Z]$/i.test(key)) {
      return key.toUpperCase();
    }
    return String.fromCharCode(65 + index);
  };

  const openCorrections = async () => {
    if (questionsForReview.length > 0) {
      setShowAnswers(true);
      return;
    }

    setLoadingCorrections(true);
    try {
      const res = await getExamCorrectionsAction(result.attemptId);
      if (res.success && res.data?.questions?.length) {
        setLoadedQuestions(res.data.questions);
        setShowAnswers(true);
      } else {
        toast.error(res.error || "Impossible de charger les corrections");
      }
    } finally {
      setLoadingCorrections(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Résultats de l'examen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
              Note de passage: {exam.passingScore}%
            </div>
          </div>

          {belowPassing && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-yellow-900 mb-1">
                      Continuez à vous entraîner!
                    </div>
                    <div className="text-sm text-yellow-800">
                      Votre score est inférieur à {exam.passingScore}%. Nous vous encourageons à refaire
                      l'examen pour améliorer votre compréhension
                      {result.canViewCorrections
                        ? ", ou à consulter les corrections si l'accès vous a été accordé."
                        : " avant de consulter les corrections."}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            {belowPassing && (
              <Button size="lg" onClick={onRetake}>
                <RotateCcw className="h-5 w-5 mr-2" />
                Réessayer l'examen
              </Button>
            )}
            {result.canViewCorrections && !showAnswers && (
              <Button size="lg" onClick={openCorrections} disabled={loadingCorrections}>
                {loadingCorrections ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Chargement…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Voir les corrections
                  </>
                )}
              </Button>
            )}
            {!belowPassing && (
              <Button size="lg" variant="outline" onClick={onRetake}>
                <RotateCcw className="h-5 w-5 mr-2" />
                Refaire l'examen
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={onExit}>
              <ArrowLeft className="h-5 w-5 mr-2" />
              Retour aux examens
            </Button>
          </div>
        </CardContent>
      </Card>

      {showAnswers && result.canViewCorrections && questionsForReview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Corrections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {questionsForReview.map((question, index) => {
              const userAnswer = result.userAnswers[question.id];
              const optionKeys = question.options ? Object.keys(question.options).sort() : [];
              const correctOptionKey = question.correctAnswer;

              return (
                <div key={question.id} className="border-b pb-6 last:border-0">
                  <div className="font-semibold mb-1">Question {index + 1}</div>
                  <SanitizedHtmlBlock
                    html={question.question}
                    plainClassName="font-medium mb-3"
                    className="mb-3"
                  />
                  <div className="space-y-2">
                    {optionKeys.map((key, keyIndex) => {
                      const optionValue = question.options[key];
                      const isCorrect = key === correctOptionKey;
                      const isUserAnswer =
                        userAnswer && userAnswer.trim().toLowerCase() === key.trim().toLowerCase();
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
                            {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
                            {isUserAnswer && !isCorrect && <XCircle className="h-4 w-4 text-red-600 ml-auto" />}
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
                      <SanitizedHtmlBlock
                        html={question.explanation}
                        plainClassName="text-sm whitespace-pre-wrap"
                        className="prose-sm text-sm"
                      />
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
