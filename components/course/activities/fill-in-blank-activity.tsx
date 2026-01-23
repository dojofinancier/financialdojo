"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle } from "lucide-react";

interface FillInBlankActivityProps {
  content: { text: string };
  correctAnswers: string[];
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialAnswers?: string[];
}

export function FillInBlankActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialAnswers,
}: FillInBlankActivityProps) {
  // Split text by blanks (___)
  const parts = content.text.split("___");
  const blankCount = parts.length - 1;
  const [answers, setAnswers] = useState<string[]>(
    initialAnswers && Array.isArray(initialAnswers) && initialAnswers.length === blankCount
      ? initialAnswers
      : new Array(blankCount).fill("")
  );

  // Update when initialAnswers changes
  useEffect(() => {
    if (initialAnswers && Array.isArray(initialAnswers) && initialAnswers.length === blankCount) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers, blankCount]);

  useEffect(() => {
    onAnswerChange(answers);
  }, [answers, onAnswerChange]);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const checkAnswer = (index: number): boolean | null => {
    if (!correctAnswers || !Array.isArray(correctAnswers)) return null;
    if (index >= correctAnswers.length) return null;
    
    // Always check answer against correctAnswers when submitted or when answers are revealed
    if (submitted || showAnswers) {
      return normalizeAnswer(answers[index] || "") === normalizeAnswer(correctAnswers[index]);
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Fill in the blanks</Label>
        <div className="mt-4 space-y-3">
          {parts.map((part, index) => (
            <span key={index}>
              <span className="text-lg">{part}</span>
              {index < parts.length - 1 && (
                <span className="inline-flex items-center gap-2 mx-2">
                  <Input
                    value={answers[index]}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    disabled={submitted}
                    className={`w-32 inline-block ${
                      (submitted || showAnswers) && checkAnswer(index) !== null
                        ? checkAnswer(index) === true
                          ? "!border-2 !border-green-500 focus-visible:ring-green-500"
                          : "!border-2 !border-red-500 focus-visible:ring-red-500"
                        : ""
                    }`}
                    placeholder="..."
                  />
                  {(submitted || showAnswers) && checkAnswer(index) !== null && (
                    <span className="inline-block">
                      {checkAnswer(index) ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </span>
                  )}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      {showAnswers && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-1">Correct answer:</p>
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

