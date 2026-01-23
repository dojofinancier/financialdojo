"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle } from "lucide-react";

interface TableCompletionActivityProps {
  content: { instructions?: string; table: { headers: string[]; rows: any[][] } };
  correctAnswers: Record<string, string>;
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialAnswers?: Record<string, string>;
}

export function TableCompletionActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialAnswers,
}: TableCompletionActivityProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});

  // Update when initialAnswers changes
  useEffect(() => {
    if (initialAnswers) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers]);

  useEffect(() => {
    onAnswerChange(answers);
  }, [answers, onAnswerChange]);

  const handleAnswerChange = (key: string, value: string) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const checkAnswer = (key: string): boolean | null => {
    if (!correctAnswers || typeof correctAnswers !== "object") return null;
    const correct = correctAnswers[key];
    if (!correct) return null;
    
    // Always check answer against correctAnswers when submitted or when answers are revealed
    if (submitted || showAnswers) {
      return normalizeAnswer(answers[key] || "") === normalizeAnswer(correct);
    }
    return null;
  };

  if (!content.table || !content.table.headers || !content.table.rows) {
    return <div>Invalid table structure</div>;
  }

  const { headers, rows } = content.table;

  return (
    <div className="space-y-4">
      {content.instructions && (
        <div>
          <Label className="text-base font-semibold">Instructions</Label>
          <p className="text-lg mt-2">{content.instructions}</p>
        </div>
      )}
      <div className="space-y-2">
        <Label>Complete the missing cells</Label>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header, idx) => (
                  <TableHead key={idx}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {row.map((cell, cellIdx) => {
                    const key = `${rowIdx}_${cellIdx}`;
                    const isBlank = cell === null || cell === undefined || cell === "";
                    const isCorrect = checkAnswer(key);

                    return (
                      <TableCell key={cellIdx}>
                        {isBlank ? (
                          <div className="relative">
                            <Input
                              value={answers[key] || ""}
                              onChange={(e) => handleAnswerChange(key, e.target.value)}
                              disabled={submitted}
                              placeholder="..."
                              className={`w-full ${
                                (submitted || showAnswers) && isCorrect !== null
                                  ? isCorrect === true
                                    ? "!border-2 !border-green-500 focus-visible:ring-green-500"
                                    : isCorrect === false
                                    ? "!border-2 !border-red-500 focus-visible:ring-red-500"
                                    : ""
                                  : ""
                              }`}
                            />
                            {(submitted || showAnswers) && isCorrect !== null && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {isCorrect ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>{cell}</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {showAnswers && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-2">Correct answers:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {Object.entries(correctAnswers).map(([key, value]) => (
              <li key={key}>
                Cell {key}: {value}
              </li>
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

