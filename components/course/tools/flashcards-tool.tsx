"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardComponent } from "../flashcard-component";

interface FlashcardsToolProps {
  courseId: string;
  onBack: () => void;
}

export function FlashcardsTool({ courseId, onBack }: FlashcardsToolProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <FlashcardComponent courseId={courseId} contentItemId="flashcards" />
    </div>
  );
}

