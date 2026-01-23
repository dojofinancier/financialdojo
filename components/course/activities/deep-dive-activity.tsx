"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface DeepDiveActivityProps {
  content: { topic: string; questions: string[] };
  onAnswerChange: (answer: any) => void;
  submitted: boolean;
  score: number | null;
  showAnswers: boolean;
  initialAnswers?: Record<string, string>;
}

export function DeepDiveActivity({
  content,
  onAnswerChange,
  submitted,
  score,
  showAnswers,
  initialAnswers,
}: DeepDiveActivityProps) {
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

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: value,
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            Deep dive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This activity will not be graded automatically. Your instructor will review your responses and provide feedback.
          </p>
        </CardContent>
      </Card>

      <div>
        <Label className="text-base font-semibold">Topic</Label>
        <p className="text-lg mt-2 font-semibold">{content.topic}</p>
      </div>

      <div className="space-y-6">
        {content.questions && Array.isArray(content.questions) && content.questions.map((question, index) => (
          <div key={index} className="space-y-2">
            <Label className="text-base">
              Question {index + 1}: {question}
            </Label>
            <Textarea
              value={answers[index] || ""}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              disabled={submitted}
              placeholder="Your answer..."
              rows={5}
              className="min-h-[120px]"
            />
          </div>
        ))}
      </div>

      {submitted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-800">
              ✓ Your response has been submitted. The instructor will provide feedback shortly.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

