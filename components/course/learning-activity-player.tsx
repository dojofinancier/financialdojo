"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { submitLearningActivityAttempt } from "@/app/actions/learning-activity-attempts";

// Lazy load activity components for code splitting
const ShortAnswerActivity = lazy(() => import("./activities/short-answer-activity").then(m => ({ default: m.ShortAnswerActivity })));
const FillInBlankActivity = lazy(() => import("./activities/fill-in-blank-activity").then(m => ({ default: m.FillInBlankActivity })));
const SortingRankingActivity = lazy(() => import("./activities/sorting-ranking-activity").then(m => ({ default: m.SortingRankingActivity })));
const ClassificationActivity = lazy(() => import("./activities/classification-activity").then(m => ({ default: m.ClassificationActivity })));
const NumericEntryActivity = lazy(() => import("./activities/numeric-entry-activity").then(m => ({ default: m.NumericEntryActivity })));
const TableCompletionActivity = lazy(() => import("./activities/table-completion-activity").then(m => ({ default: m.TableCompletionActivity })));
const ErrorSpottingActivity = lazy(() => import("./activities/error-spotting-activity").then(m => ({ default: m.ErrorSpottingActivity })));
const DeepDiveActivity = lazy(() => import("./activities/deep-dive-activity").then(m => ({ default: m.DeepDiveActivity })));

// Skeleton loader for activity components
const ActivitySkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-10 w-32" />
  </div>
);

interface LearningActivityPlayerProps {
  activity: {
    id: string;
    activityType: string;
    title: string;
    instructions: string | null;
    content: any;
    correctAnswers?: any;
    tolerance?: number | null;
    module?: {
      id: string;
      title: string;
    } | null;
  };
  activityId?: string;
  initialAnswer?: any;
  initialSubmitted?: boolean;
  initialScore?: number | null;
  attemptNumber?: number;
  answersRevealed?: boolean;
  reviewMode?: boolean;
  onAnswerChange?: (answers: any) => void;
  onComplete?: (score: number | null) => void;
  onNext?: () => void;
  onReset?: () => void;
  onRevealAnswers?: () => void;
}

export function LearningActivityPlayer({
  activity,
  initialAnswer = null,
  initialSubmitted = false,
  initialScore = null,
  attemptNumber = 0,
  answersRevealed = false,
  onAnswerChange,
  onComplete,
  onNext,
  onReset,
  onRevealAnswers,
}: LearningActivityPlayerProps) {
  const [answers, setAnswers] = useState<any>(initialAnswer);
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [score, setScore] = useState<number | null>(initialScore);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [resetKey, setResetKey] = useState(0);
  const [showAnswers, setShowAnswers] = useState(answersRevealed);

  // Update state when activity changes - this should reset to the correct initial values for the new activity
  useEffect(() => {
    // Always reset to the initial values when activity changes
    // For new questions, initialAnswer will be null, so answers should be null
    // For previously answered questions, initialAnswer will have the stored value
    setAnswers(initialAnswer);
    setSubmitted(initialSubmitted ?? false);
    setScore(initialScore ?? null);
    setSubmitting(false);
    setStartTime(Date.now());
    setResetKey(0);
    setShowAnswers(answersRevealed);
  }, [activity.id, initialAnswer, initialSubmitted, initialScore, answersRevealed]); // Include initial values to ensure proper sync

  const handleSubmit = async () => {
    if (!answers) {
      toast.error("Please answer the activity");
      return;
    }

    setSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const result = await submitLearningActivityAttempt({
        learningActivityId: activity.id,
        answers,
        timeSpent,
      });

      if (result.success && result.data) {
        setSubmitted(true);
        setScore(result.data.score);
        toast.success(
          result.data.isGraded
            ? `Activité terminée! Score: ${result.data.score}%`
            : "Activity submitted! It will be reviewed by the instructor."
        );
        if (onComplete) {
          onComplete(result.data.score);
        }
      } else {
        toast.error(result.error || "Error during submission");
      }
    } catch (error) {
      console.error("Error submitting activity:", error);
      toast.error("Error submitting activity");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = useCallback((newAnswers: any) => {
    setAnswers(newAnswers);
    if (onAnswerChange) {
      onAnswerChange(newAnswers);
    }
  }, [onAnswerChange]);

  const renderActivity = () => {
    // Determine initial value based on activity type and stored answer
    // Use initialAnswer prop directly (which comes from parent's activityStates)
    // This ensures we get the correct value for the current activity, not a stale one
    const getInitialValue = () => {
      // Use the initialAnswer prop, not the local answers state
      // initialAnswer is already correctly set by the parent based on currentActivity.id
      if (initialAnswer === null || initialAnswer === undefined) return undefined;
      
      switch (activity.activityType) {
        case "SHORT_ANSWER":
          return typeof initialAnswer === "string" ? initialAnswer : undefined;
        case "NUMERIC_ENTRY":
          return typeof initialAnswer === "number" ? initialAnswer.toString() : undefined;
        case "ERROR_SPOTTING":
          return typeof initialAnswer === "string" ? initialAnswer : undefined;
        default:
          return undefined;
      }
    };

    const getInitialAnswers = () => {
      // For activities that use objects/arrays, use initialAnswer directly
      return initialAnswer;
    };

    const commonProps = {
      content: activity.content,
      correctAnswers: activity.correctAnswers,
      tolerance: activity.tolerance ?? null,
      onAnswerChange: handleAnswerChange,
      submitted,
      score, // Pass score for immediate visual feedback
      showAnswers: showAnswers, // Use state instead of submitted - only show when user reveals
      initialValue: getInitialValue(),
      initialAnswers: getInitialAnswers(),
    };

    // Use key prop based on activity ID and reset key to force remount when:
    // 1. Activity changes (different activity.id)
    // 2. User clicks "Réessayer" (resetKey increments)
    // This preserves the submitted answer until user navigates away or resets
    const componentKey = `${activity.id}-${resetKey}`;

    // Pass initial values explicitly - use undefined (not null) for new questions to ensure components reset
    const passInitialValue = commonProps.initialValue !== undefined ? commonProps.initialValue : "";
    const passInitialAnswers = commonProps.initialAnswers !== null && commonProps.initialAnswers !== undefined 
      ? commonProps.initialAnswers 
      : undefined;

    switch (activity.activityType) {
      case "SHORT_ANSWER":
        return <ShortAnswerActivity key={componentKey} {...commonProps} initialValue={passInitialValue} />;
      case "FILL_IN_BLANK":
        return <FillInBlankActivity key={componentKey} {...commonProps} initialAnswers={Array.isArray(passInitialAnswers) ? passInitialAnswers : undefined} />;
      case "SORTING_RANKING":
        return <SortingRankingActivity key={componentKey} {...commonProps} initialOrder={Array.isArray(passInitialAnswers) ? passInitialAnswers : undefined} />;
      case "CLASSIFICATION":
        return <ClassificationActivity key={componentKey} {...commonProps} initialClassifications={passInitialAnswers && typeof passInitialAnswers === "object" && !Array.isArray(passInitialAnswers) ? passInitialAnswers : undefined} />;
      case "NUMERIC_ENTRY":
        return <NumericEntryActivity key={componentKey} {...commonProps} initialValue={passInitialValue} />;
      case "TABLE_COMPLETION":
        return <TableCompletionActivity key={componentKey} {...commonProps} initialAnswers={passInitialAnswers && typeof passInitialAnswers === "object" && !Array.isArray(passInitialAnswers) ? passInitialAnswers : undefined} />;
      case "ERROR_SPOTTING":
        return <ErrorSpottingActivity key={componentKey} {...commonProps} initialValue={passInitialValue} />;
      case "DEEP_DIVE":
        return <DeepDiveActivity key={componentKey} {...commonProps} initialAnswers={passInitialAnswers && typeof passInitialAnswers === "object" && !Array.isArray(passInitialAnswers) ? passInitialAnswers : undefined} />;
      default:
        return <div key={componentKey}>Type d'activité non reconnu</div>;
    }
  };

  const ACTIVITY_TYPE_LABELS: Record<string, string> = {
    SHORT_ANSWER: "Short answer",
    FILL_IN_BLANK: "Fill-in-the-blank",
    SORTING_RANKING: "Tri / Classement",
    CLASSIFICATION: "Classification",
    NUMERIC_ENTRY: "Numeric calculation",
    TABLE_COMPLETION: "Table to complete",
    ERROR_SPOTTING: "Error detection",
    DEEP_DIVE: "Approfondissement",
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">
                {ACTIVITY_TYPE_LABELS[activity.activityType] || activity.activityType}
              </Badge>
              {attemptNumber > 0 && (
                <Badge variant="outline">
                  Tentative #{attemptNumber}
                </Badge>
              )}
              {activity.module && (
                <CardDescription>Module: {activity.module.title}</CardDescription>
              )}
            </div>
            {activity.instructions && (
              <p className="text-base mt-2">{activity.instructions}</p>
            )}
          </div>
          {submitted && score !== null && (
            <Badge variant={score >= 70 ? "default" : "destructive"} className="ml-4">
              {score}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Suspense fallback={<ActivitySkeleton />}>
          {renderActivity()}
        </Suspense>

        {!submitted && (
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={handleSubmit} disabled={submitting || !answers}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Soumission...
                </>
              ) : (
                "Soumettre"
              )}
            </Button>
          </div>
        )}

        {submitted && (
          <div className="space-y-4 pt-4">
            {!showAnswers && (
              <div className="flex justify-between items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset state and force component remount by incrementing reset key
                    setAnswers(null);
                    setSubmitted(false);
                    setScore(null);
                    setShowAnswers(false);
                    setStartTime(Date.now());
                    setResetKey((prev) => prev + 1); // Increment to force remount
                    if (onReset) {
                      onReset();
                    }
                    if (onAnswerChange) {
                      onAnswerChange(null);
                    }
                    toast.info("Answers have been reset. You can try again.");
                  }}
                >
                  Réessayer
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowAnswers(true);
                    if (onRevealAnswers) {
                      onRevealAnswers();
                    }
                  }}
                >
                  Révéler les réponses
                </Button>
              </div>
            )}
            {showAnswers && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset state and force component remount by incrementing reset key
                    setAnswers(null);
                    setSubmitted(false);
                    setScore(null);
                    setShowAnswers(false);
                    setStartTime(Date.now());
                    setResetKey((prev) => prev + 1); // Increment to force remount
                    if (onReset) {
                      onReset();
                    }
                    if (onAnswerChange) {
                      onAnswerChange(null);
                    }
                    toast.info("Answers have been reset. You can try again.");
                  }}
                >
                  Réessayer
                </Button>
                {onNext && (
                  <Button onClick={onNext}>Suivant</Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

