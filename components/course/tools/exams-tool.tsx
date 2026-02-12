"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExamList } from "../exam-list";

interface ExamsToolProps {
  courseId: string;
  onBack: () => void;
  onStartExam: (examId: string) => void;
}

export function ExamsTool({ courseId, onBack, onStartExam }: ExamsToolProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <ExamList courseId={courseId} onStartExam={onStartExam} />
    </div>
  );
}

