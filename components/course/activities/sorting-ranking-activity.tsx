"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GripVertical, ArrowUp, ArrowDown, CheckCircle2, XCircle } from "lucide-react";

interface SortingRankingActivityProps {
  content: { instructions?: string; items: string[] };
  correctAnswers: string[];
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialOrder?: string[];
}

export function SortingRankingActivity({
  content,
  correctAnswers,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialOrder,
}: SortingRankingActivityProps) {
  const [items, setItems] = useState<string[]>(() => {
    // Use initial order if provided, otherwise shuffle
    if (initialOrder && Array.isArray(initialOrder) && initialOrder.length > 0) {
      return initialOrder;
    }
    if (content.items && Array.isArray(content.items)) {
      return [...content.items].sort(() => Math.random() - 0.5);
    }
    return [];
  });

  useEffect(() => {
    // Update when initialOrder changes (e.g., navigating back to a previously answered question)
    if (initialOrder && Array.isArray(initialOrder) && initialOrder.length > 0) {
      setItems(initialOrder);
    } else if (items.length === 0 && content.items && Array.isArray(content.items)) {
      setItems([...content.items].sort(() => Math.random() - 0.5));
    }
  }, [initialOrder, content.items, items.length]);

  useEffect(() => {
    onAnswerChange(items);
  }, [items, onAnswerChange]);

  const moveItem = (index: number, direction: "up" | "down") => {
    if (submitted) return;
    const newItems = [...items];
    if (direction === "up" && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === "down" && index < newItems.length - 1) {
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    setItems(newItems);
  };

  // Show immediate feedback when submitted
  const showImmediateFeedback = submitted && score !== null;
  
  // Check if overall order is correct
  const isCorrectOverall = correctAnswers && Array.isArray(correctAnswers)
    ? items.every((item, index) => item === correctAnswers[index])
    : false;
  
  // Check individual item correctness
  const checkItem = (index: number): boolean | null => {
    if (!submitted && !showAnswers) return null;
    if (!correctAnswers || !Array.isArray(correctAnswers)) return null;
    return items[index] === correctAnswers[index];
  };

  return (
    <div className="space-y-4">
      {content.instructions && (
        <div>
          <Label className="text-base font-semibold">Instructions</Label>
          <p className="text-lg mt-2">{content.instructions}</p>
        </div>
      )}
      <div className="space-y-2">
        <Label>Order the items correctly</Label>
        <div className="space-y-2">
          {items.map((item, index) => {
            const itemCorrect = checkItem(index);
            return (
              <Card
                key={index}
                className={
                  (showImmediateFeedback || showAnswers) && itemCorrect !== null
                    ? itemCorrect === false
                      ? "!border-2 !border-red-500"
                      : itemCorrect === true
                      ? "!border-2 !border-green-500"
                      : ""
                    : ""
                }
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold text-muted-foreground w-8">{index + 1}.</span>
                  </div>
                  <div className="flex-1">{item}</div>
                  {!submitted && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveItem(index, "down")}
                        disabled={index === items.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {(showImmediateFeedback || showAnswers) && itemCorrect !== null && (
                    <div>
                      {itemCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      {(showImmediateFeedback || showAnswers) && !isCorrectOverall && correctAnswers && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-semibold mb-2">Ordre correct:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {correctAnswers.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

