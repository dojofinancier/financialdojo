"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Brain, BookOpen, Zap, CheckCircle2 } from "lucide-react";
import {
  getSmartReviewStatsAction,
  getNextReviewItemAction,
  type SmartReviewStats,
  type SmartReviewItemWithRelations,
} from "@/app/actions/smart-review";
import { toast } from "sonner";
import { SmartReviewSession } from "./smart-review-session";

interface SmartReviewDashboardProps {
  courseId: string;
  course: any;
  settings: any;
}

export function SmartReviewDashboard({ courseId, course, settings }: SmartReviewDashboardProps) {
  const [stats, setStats] = useState<SmartReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [currentItem, setCurrentItem] = useState<SmartReviewItemWithRelations | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const result = await getSmartReviewStatsAction(courseId);
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleStartReview = async () => {
    setIsStarting(true);
    try {
      const result = await getNextReviewItemAction(courseId);
      
      if (!result.success || !result.data) {
        toast.error(result.error || "No items available for review");
        return;
      }

      setCurrentItem(result.data);
      setIsReviewing(true);
    } catch (error) {
      console.error("Error starting review:", error);
      toast.error("An error occurred");
    } finally {
      setIsStarting(false);
    }
  };

  const handleNextItem = async () => {
    try {
      const result = await getNextReviewItemAction(courseId);
      
      if (!result.success || !result.data) {
        toast.info("You have reviewed all available items!");
        setIsReviewing(false);
        setCurrentItem(null);
        loadStats(); // Refresh stats
        return;
      }

      setCurrentItem(result.data);
    } catch (error) {
      console.error("Error getting next item:", error);
      toast.error("An error occurred");
    }
  };

  const handleExit = () => {
    setIsReviewing(false);
    setCurrentItem(null);
    loadStats(); // Refresh stats
  };

  // Show review session if active
  if (isReviewing && currentItem) {
    return (
      <SmartReviewSession
        courseId={courseId}
        currentItem={currentItem}
        onNext={handleNextItem}
        onExit={handleExit}
        totalReviewed={stats?.totalItemsReviewed || 0}
      />
    );
  }

  // Calculate totals
  const totalFlashcards = stats?.chapterStats.reduce((sum, c) => sum + c.totalFlashcards, 0) || 0;
  const totalActivities = stats?.chapterStats.reduce((sum, c) => sum + c.totalActivities, 0) || 0;
  const totalItems = totalFlashcards + totalActivities;
  const reviewedFlashcards = stats?.chapterStats.reduce((sum, c) => sum + c.flashcardsReviewed, 0) || 0;
  const reviewedActivities = stats?.chapterStats.reduce((sum, c) => sum + c.activitiesReviewed, 0) || 0;
  const totalReviewed = reviewedFlashcards + reviewedActivities;

  const chapterStats = stats?.chapterStats ?? [];
  const hasCompletedChapters = (stats?.completedChapters?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-0 shadow-none sm:border sm:shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Smart review
          </CardTitle>
          <CardDescription>
            Review a random mix of flashcards and activities from your completed chapters.
            Items are prioritized to maximize coverage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg sm:bg-muted/50 sm:border sm:border-border/40">
              <div className="text-2xl font-bold text-primary">
                {isLoading ? "..." : stats?.completedChapters?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Unlocked chapters</div>
            </div>
            <div className="text-center p-3 rounded-lg sm:bg-muted/50 sm:border sm:border-border/40">
              <div className="text-2xl font-bold">
                {isLoading ? "..." : totalItems}
              </div>
              <div className="text-xs text-muted-foreground">Available items</div>
            </div>
            <div className="text-center p-3 rounded-lg sm:bg-muted/50 sm:border sm:border-border/40">
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? "..." : totalReviewed}
              </div>
              <div className="text-xs text-muted-foreground">Items seen</div>
            </div>
            <div className="text-center p-3 rounded-lg sm:bg-muted/50 sm:border sm:border-border/40">
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stats?.totalItemsReviewed || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total reviews</div>
            </div>
          </div>

          {/* Start Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartReview}
            disabled={isStarting || isLoading || !hasCompletedChapters}
          >
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? "Loading..." : "Start review"}
          </Button>

          {!hasCompletedChapters && !isLoading && (
            <p className="text-sm text-muted-foreground text-center">
              Complete at least one chapter in the learning phase to unlock smart review.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chapter Stats */}
      {chapterStats.length > 0 && (
        <Card className="border-0 shadow-none sm:border sm:shadow">
          <CardHeader>
            <CardTitle className="text-lg">Progress by chapter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chapterStats
                .sort((a, b) => a.moduleOrder - b.moduleOrder)
                .map((chapter) => (
                  <div
                    key={chapter.moduleId}
                    className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg sm:border sm:border-border/60 sm:bg-background sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-base sm:text-sm sm:truncate sm:max-w-[200px] md:max-w-none">
                        {chapter.moduleTitle}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Badge variant="outline" className="text-sm sm:text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        {chapter.flashcardsReviewed}/{chapter.totalFlashcards}
                      </Badge>
                      <Badge variant="outline" className="text-sm sm:text-xs">
                        <BookOpen className="h-3 w-3 mr-1" />
                        {chapter.activitiesReviewed}/{chapter.totalActivities}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Locked Chapters Info */}
      {course.modules && stats && (
        <Card className="border-0 shadow-none sm:border-dashed sm:shadow-none">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                {course.modules.length - (stats.completedChapters.length || 0)} chapter(s) remaining to unlock.
              </p>
              <p className="text-xs mt-1">
                Mark chapters as completed in the learning phase to add them to review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
