"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearningActivitiesList } from "../learning-activities-list";

interface ActivitiesToolProps {
  courseId: string;
  onBack: () => void;
}

export function ActivitiesTool({ courseId, onBack }: ActivitiesToolProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <LearningActivitiesList courseId={courseId} />
    </div>
  );
}

