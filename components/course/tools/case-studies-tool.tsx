"use client";

import { CaseStudyList } from "../case-study-list";
import { CaseStudyPlayer } from "../case-study-player";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface CaseStudiesToolProps {
  courseId: string;
  onBack: () => void;
  onStartCaseStudy?: (caseStudyId: string) => void;
}

export function CaseStudiesTool({ courseId, onBack, onStartCaseStudy }: CaseStudiesToolProps) {
  const [selectedCaseStudyId, setSelectedCaseStudyId] = useState<string | null>(null);

  const handleStartCaseStudy = (caseStudyId: string) => {
    if (onStartCaseStudy) {
      onStartCaseStudy(caseStudyId);
    } else {
      setSelectedCaseStudyId(caseStudyId);
    }
  };

  if (selectedCaseStudyId) {
    return (
      <CaseStudyPlayer
        caseStudyId={selectedCaseStudyId}
        onExit={() => setSelectedCaseStudyId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Case studies</h1>
          <p className="text-muted-foreground mt-1">
            Analyze real scenarios and answer questions based on the narrative
          </p>
        </div>
      </div>
      <CaseStudyList courseId={courseId} onStartCaseStudy={handleStartCaseStudy} />
    </div>
  );
}
