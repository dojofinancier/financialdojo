"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionBankPractice } from "../question-bank-practice";

interface QuestionBankToolProps {
  courseId: string;
  onBack: () => void;
}

export function QuestionBankTool({ courseId, onBack }: QuestionBankToolProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <QuestionBankPractice courseId={courseId} />
    </div>
  );
}

