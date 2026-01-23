"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronRight, Zap, BookOpen } from "lucide-react";
import { ReviewDifficulty } from "@prisma/client";
import {
  rateReviewItemAction,
  type SmartReviewItemWithRelations,
} from "@/app/actions/smart-review";
import { toast } from "sonner";
import { LearningActivityReview } from "./learning-activity-review";

interface SmartReviewSessionProps {
  courseId: string;
  currentItem: SmartReviewItemWithRelations;
  onNext: () => Promise<void>;
  onExit: () => void;
  totalReviewed: number;
}

export function SmartReviewSession({
  courseId,
  currentItem,
  onNext,
  onExit,
  totalReviewed,
}: SmartReviewSessionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);

  const handleRating = async (difficulty: ReviewDifficulty) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await rateReviewItemAction(currentItem.id, difficulty);

      if (!result.success) {
        toast.error(result.error || "Error saving");
        setIsSubmitting(false);
        return;
      }

      // Reset state and get next item
      setShowAnswer(false);
      setSessionCount((prev) => prev + 1);
      await onNext();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      setShowAnswer(false);
      setSessionCount((prev) => prev + 1);
      await onNext();
    } catch (error) {
      console.error("Error skipping:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemType = currentItem.flashcardId ? "flashcard" : "activity";
  const isFlashcard = itemType === "flashcard";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {isFlashcard ? (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Flashcard
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3 w-3 mr-1" />
                    Activity
                  </>
                )}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {currentItem.module?.title}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Session: {sessionCount} | Total: {totalReviewed + sessionCount}
              </span>
              <Button variant="ghost" size="icon" onClick={onExit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Item Content */}
          <div className="min-h-[300px]">
            {isFlashcard && currentItem.flashcard && (
              <div className="space-y-6">
                {/* Question */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Question</p>
                  <p className="text-lg font-medium">{currentItem.flashcard.front}</p>
                </div>

                {/* Answer (hidden until revealed) */}
                {!showAnswer ? (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowAnswer(true)}
                    >
                      View answer
                    </Button>
                  </div>
                ) : (
                  <div className="border-t pt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Answer</p>
                    <p className="text-lg">{currentItem.flashcard.back}</p>
                  </div>
                )}
              </div>
            )}

            {!isFlashcard && currentItem.learningActivity && (
              <LearningActivityReview
                activityId={currentItem.learningActivity.id}
                activity={currentItem.learningActivity}
                reviewMode={true}
              />
            )}
          </div>

          {/* Rating Buttons - Only show after answer is revealed (for flashcards) or always (for activities) */}
          {(showAnswer || !isFlashcard) && (
            <div className="space-y-4 border-t pt-6 bg-gradient-to-b from-muted/30 to-transparent -mx-6 px-6 pb-2">
              <p className="text-base font-semibold text-center">
                How was it? <span className="text-muted-foreground font-normal text-sm">(click to continue)</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  size="lg"
                  onClick={() => handleRating("EASY")}
                  disabled={isSubmitting}
                  className="h-16 bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg hover:shadow-xl transition-all text-xl font-bold"
                >
                  Easy
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleRating("MEDIUM")}
                  disabled={isSubmitting}
                  className="h-16 bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all text-xl font-bold"
                >
                  Medium
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleRating("HARD")}
                  disabled={isSubmitting}
                  className="h-16 bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg hover:shadow-xl transition-all text-xl font-bold"
                >
                  Hard
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Easy = appears less often • Hard = appears more often
              </p>
            </div>
          )}

          {/* Skip Button - Less prominent */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="text-muted-foreground text-xs"
            >
              Skip without rating
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Item Info */}
      <div className="text-center text-xs text-muted-foreground">
        Seen {currentItem.timesServed} times
        {currentItem.lastDifficulty && (
          <> • Last rating: {
            currentItem.lastDifficulty === "EASY" ? "Easy" :
            currentItem.lastDifficulty === "MEDIUM" ? "Medium" : "Hard"
          }</>
        )}
      </div>
    </div>
  );
}
