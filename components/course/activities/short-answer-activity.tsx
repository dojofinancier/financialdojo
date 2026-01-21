"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortAnswerActivityProps {
  content: { question: string };
  correctAnswers: string[];
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialValue?: string;
}

export function ShortAnswerActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialValue = "",
}: ShortAnswerActivityProps) {
  const [answer, setAnswer] = useState(initialValue || "");
  const isSyncingFromParent = useRef(false);
  
  // Update when initialValue changes (e.g., when navigating back to a previously answered question)
  useEffect(() => {
    // Always sync with parent's initialValue
    // If initialValue is undefined or empty string, it means it's a new question - clear the field
    const newValue = initialValue || "";
    if (newValue !== answer) {
      isSyncingFromParent.current = true;
      setAnswer(newValue);
    }
  }, [initialValue]);

  useEffect(() => {
    // Only call onAnswerChange when user changes the value, not when syncing from parent
    if (!isSyncingFromParent.current) {
      onAnswerChange(answer);
    } else {
      // Reset flag after syncing
      isSyncingFromParent.current = false;
    }
  }, [answer, onAnswerChange]);

  // Check if answer is correct by comparing to correctAnswers
  const checkIfCorrect = (): boolean => {
    if (!correctAnswers || !Array.isArray(correctAnswers)) return false;
    return correctAnswers.some((correct) => normalizeAnswer(answer) === normalizeAnswer(correct));
  };

  const isCorrect = checkIfCorrect();
  
  // Show immediate feedback when submitted (based on score or by checking answer)
  const showImmediateFeedback = submitted && score !== null;
  // For immediate feedback, check the answer directly against correctAnswers
  const isCorrectImmediate = showImmediateFeedback ? isCorrect : false;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Question</Label>
        <p className="text-lg mt-2">{content.question}</p>
      </div>
      <div className="space-y-2">
        <Label>Votre réponse</Label>
        <div className="relative">
          <Input
            value={answer}
            onChange={(e) => {
              isSyncingFromParent.current = false;
              setAnswer(e.target.value);
            }}
            disabled={submitted}
            placeholder="Type your response..."
            className={cn(
              showImmediateFeedback || showAnswers
                ? isCorrectImmediate || (showAnswers && isCorrect)
                  ? "!border-2 !border-green-500"
                  : "!border-2 !border-red-500"
                : ""
            )}
          />
          {(showImmediateFeedback || showAnswers) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {showImmediateFeedback ? (
                isCorrectImmediate ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )
              ) : showAnswers ? (
                isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )
              ) : null}
            </div>
          )}
        </div>
      </div>
      {showAnswers && !isCorrect && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-1">Réponses acceptables:</p>
          <ul className="list-disc list-inside text-sm">
            {correctAnswers.map((ans, idx) => (
              <li key={idx}>{ans}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

