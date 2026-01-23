"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle } from "lucide-react";

interface NumericEntryActivityProps {
  content: { question: string };
  correctAnswers: number;
  tolerance: number | null;
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialValue?: string;
}

export function NumericEntryActivity({
  content,
  correctAnswers,
  tolerance,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialValue,
}: NumericEntryActivityProps) {
  const [answer, setAnswer] = useState<string>(initialValue || "");

  // Update when initialValue changes
  useEffect(() => {
    if (initialValue !== undefined) {
      setAnswer(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    const numAnswer = parseFloat(answer);
    if (!isNaN(numAnswer)) {
      onAnswerChange(numAnswer);
    } else {
      onAnswerChange(null);
    }
  }, [answer, onAnswerChange]);

  const isCorrect = (): boolean | null => {
    if (answer === "") return null;
    const numAnswer = parseFloat(answer);
    if (isNaN(numAnswer)) return false;

    if (tolerance === null || tolerance === undefined) {
      return numAnswer === correctAnswers;
    }

    if (tolerance >= 1) {
      // Percentage tolerance
      const percentDiff = Math.abs((numAnswer - correctAnswers) / correctAnswers) * 100;
      return percentDiff <= tolerance;
    } else {
      // Absolute tolerance
      const diff = Math.abs(numAnswer - correctAnswers);
      return diff <= tolerance;
    }
  };

  // Show immediate feedback when submitted
  const showImmediateFeedback = submitted && score !== null;
  const correct = (showImmediateFeedback || showAnswers) ? isCorrect() : null;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Question / Problem</Label>
        <p className="text-lg mt-2 whitespace-pre-wrap">{content.question}</p>
      </div>
      <div className="space-y-2">
        <Label>Your answer (number)</Label>
        <div className="relative">
          <Input
            type="number"
            step="any"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="0.00"
            className={
              showImmediateFeedback || showAnswers
                ? correct === true
                  ? "!border-2 !border-green-500 focus-visible:ring-green-500"
                  : correct === false
                  ? "!border-2 !border-red-500 focus-visible:ring-red-500"
                  : ""
                : ""
            }
          />
          {(showImmediateFeedback || showAnswers) && correct !== null && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {correct ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          )}
        </div>
        {tolerance !== null && (
          <p className="text-xs text-muted-foreground">
            Tolerance: {tolerance >= 1 ? `±${tolerance}%` : `±${tolerance}`}
          </p>
        )}
      </div>
      {showAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm">
            <span className="font-semibold">Correct answer:</span> {correctAnswers}
          </p>
        </div>
      )}
    </div>
  );
}

