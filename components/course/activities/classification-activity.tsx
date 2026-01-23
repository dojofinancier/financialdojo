"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle } from "lucide-react";

interface ClassificationActivityProps {
  content: { instructions?: string; categories: string[]; items: Record<string, string> };
  correctAnswers: Record<string, string>;
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialClassifications?: Record<string, string>;
}

export function ClassificationActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialClassifications,
}: ClassificationActivityProps) {
  // Extract items from content.items object
  const itemsList = content.items && typeof content.items === "object" && !Array.isArray(content.items)
    ? Object.keys(content.items)
    : [];
  
  const categories = content.categories && Array.isArray(content.categories) ? content.categories : [];
  const [classifications, setClassifications] = useState<Record<string, string>>(initialClassifications || {});

  // Update when initialClassifications changes
  useEffect(() => {
    if (initialClassifications) {
      setClassifications(initialClassifications);
    }
  }, [initialClassifications]);

  useEffect(() => {
    onAnswerChange(classifications);
  }, [classifications, onAnswerChange]);

  const handleClassificationChange = (item: string, category: string) => {
    if (submitted) return;
    setClassifications((prev) => ({
      ...prev,
      [item]: category,
    }));
  };

  const checkItem = (item: string): boolean | null => {
    if (!correctAnswers || typeof correctAnswers !== "object") return null;
    const correctCategory = correctAnswers[item];
    if (!correctCategory) return null;
    
    // Always check answer against correctAnswers when submitted or when answers are revealed
    if (submitted || showAnswers) {
      return normalizeAnswer(classifications[item] || "") === normalizeAnswer(correctCategory);
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {content.instructions && (
        <div>
          <Label className="text-base font-semibold">Instructions</Label>
          <p className="text-lg mt-2">{content.instructions}</p>
        </div>
      )}
      <div className="space-y-4">
        <Label>Place each item in the correct category</Label>
        <div className="grid gap-4 md:grid-cols-2">
          {itemsList.map((item) => {
            const isCorrect = checkItem(item);
            return (
              <Card
                key={item}
                className={
                  (submitted || showAnswers) && isCorrect !== null
                    ? isCorrect === false
                      ? "!border-2 !border-red-500"
                      : isCorrect === true
                      ? "!border-2 !border-green-500"
                      : ""
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-2">{item}</p>
                      <Select
                        value={classifications[item] || ""}
                        onValueChange={(value) => handleClassificationChange(item, value)}
                        disabled={submitted}
                      >
                        <SelectTrigger
                          className={
                            (submitted || showAnswers) && isCorrect !== null
                              ? isCorrect === false
                                ? "!border-2 !border-red-500"
                                : isCorrect === true
                                ? "!border-2 !border-green-500"
                                : ""
                              : ""
                          }
                        >
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(submitted || showAnswers) && isCorrect !== null && (
                      <div className="mt-8">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      {showAnswers && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-2">Classifications correctes:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {Object.entries(correctAnswers).map(([item, category]) => (
              <li key={item}>
                <span className="font-medium">{item}</span>: {category}
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

