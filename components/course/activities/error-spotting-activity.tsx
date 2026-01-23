"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface ErrorSpottingActivityProps {
  content: { question: string; incorrectSolution: string };
  correctAnswers: string;
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialValue?: string;
}

export function ErrorSpottingActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialValue = "",
}: ErrorSpottingActivityProps) {
  const [answer, setAnswer] = useState(initialValue);

  // Update when initialValue changes
  useEffect(() => {
    setAnswer(initialValue);
  }, [initialValue]);

  useEffect(() => {
    onAnswerChange(answer);
  }, [answer, onAnswerChange]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Question</Label>
        <p className="text-lg mt-2">{content.question}</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Label className="text-sm font-semibold mb-2 block">Solution avec erreur:</Label>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md font-mono">
            {content.incorrectSolution}
          </pre>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Label>Identifiez l'erreur</Label>
        <div className="relative">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Describe the error you identified..."
            rows={4}
            className={
              submitted && score !== null
                ? score === 100
                  ? "!border-2 !border-green-500 focus-visible:ring-green-500"
                  : score > 0
                  ? "!border-2 !border-yellow-500 focus-visible:ring-yellow-500"
                  : "!border-2 !border-red-500 focus-visible:ring-red-500"
                : ""
            }
          />
          {submitted && score !== null && (
            <div className="absolute right-3 top-3">
              {score === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : score > 0 ? (
                <XCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          )}
        </div>
      </div>
      {showAnswers && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-1">Expected answer:</p>
          <p className="text-sm">{correctAnswers}</p>
        </div>
      )}
    </div>
  );
}

