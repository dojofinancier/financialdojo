"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Layers, BookOpen } from "lucide-react";
import { FlashcardComponent } from "./flashcard-component";
import { LearningActivitiesList } from "./learning-activities-list";
import { SmartReviewDashboard } from "./smart-review-dashboard";

interface Phase2ReviewProps {
  courseId: string;
  course: any;
  settings: any;
}

export function Phase2Review({ courseId, course, settings }: Phase2ReviewProps) {
  const [activeTab, setActiveTab] = useState<"smart-review" | "flashcards" | "activities">("smart-review");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Phase 2 - Review and active recall
          </CardTitle>
          <CardDescription>
            Consolidate knowledge through active recall and spaced repetition.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
              <TabsTrigger value="smart-review" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-1 sm:px-3 min-w-0">
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">Smart review</span>
                <span className="sm:hidden truncate">Review</span>
              </TabsTrigger>
              <TabsTrigger value="flashcards" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-1 sm:px-3 min-w-0">
                <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Flashcards</span>
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-1 sm:px-3 min-w-0">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Activities</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="smart-review" className="mt-6">
              <SmartReviewDashboard courseId={courseId} course={course} settings={settings} />
            </TabsContent>
            <TabsContent value="flashcards" className="mt-6">
              <FlashcardComponent courseId={courseId} contentItemId="flashcards" />
            </TabsContent>
            <TabsContent value="activities" className="mt-6">
              <LearningActivitiesList courseId={courseId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
