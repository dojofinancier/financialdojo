"use client";

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLearningActivityAttempts, getBatchLearningActivityAttempts } from "@/app/actions/learning-activity-attempts";
import { LearningActivityPlayer } from "./learning-activity-player";
import { toast } from "sonner";
import { Loader2, Shuffle, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { useLearningActivities, useCourseModules } from "@/lib/hooks/use-learning-activities";

interface LearningActivitiesListProps {
  courseId: string;
}

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

const ACTIVITY_TYPES = [
  "SHORT_ANSWER",
  "FILL_IN_BLANK",
  "SORTING_RANKING",
  "CLASSIFICATION",
  "NUMERIC_ENTRY",
  "TABLE_COMPLETION",
  "ERROR_SPOTTING",
  "DEEP_DIVE",
] as const;

export function LearningActivitiesList({ courseId }: LearningActivitiesListProps) {
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [randomMode, setRandomMode] = useState(true);
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null); // Stable shuffle seed
  // Store answers and submission status per activity ID
  const [activityStates, setActivityStates] = useState<Record<string, {
    answers: any;
    submitted: boolean;
    score: number | null;
    attemptNumber: number;
    answersRevealed: boolean;
  }>>({});

  // Use React Query hooks for automatic caching and deduplication
  const { data: activitiesResult, isLoading: activitiesLoading } = useLearningActivities(courseId);
  const { data: modules, isLoading: modulesLoading } = useCourseModules(courseId);
  
  const loading = activitiesLoading || modulesLoading;

  // Get available activity types (only those that exist in the course)
  const availableActivityTypes = useMemo(() => {
    const types = new Set<string>();
    allActivities.forEach((activity: any) => {
      if (activity.activityType) {
        types.add(activity.activityType);
      }
    });
    return Array.from(types);
  }, [allActivities]);

  // Process activities data when it loads from React Query
  useEffect(() => {
    if (activitiesResult?.success && activitiesResult.data) {
      setAllActivities(activitiesResult.data);
      
      // Process attempts data
      if (activitiesResult.attempts) {
        const attemptsData = activitiesResult.attempts as Record<string, { mostRecentAttempt: any; attemptCount: number }>;
        const newActivityStates: Record<string, any> = {};
        
        Object.entries(attemptsData).forEach(([activityId, data]) => {
          // Only set state if there's a most recent attempt
          if (data.mostRecentAttempt) {
            newActivityStates[activityId] = {
              answers: data.mostRecentAttempt.answers,
              submitted: true,
              score: data.mostRecentAttempt.score,
              attemptNumber: data.attemptCount,
              answersRevealed: false, // Don't reveal answers automatically
            };
          }
          // If no attempts, activity will start with default state (null answers, not submitted)
        });
        
        setActivityStates(newActivityStates);
      }
    } else if (activitiesResult && !activitiesResult.success) {
      toast.error(activitiesResult.error || "Error loading activities");
      setAllActivities([]);
    }
  }, [activitiesResult]);

  useEffect(() => {
    filterActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleId, selectedActivityType, allActivities, randomMode]);


  const filterActivities = useCallback(() => {
    let filtered = [...allActivities];

    // Filter by module
    if (selectedModuleId) {
      filtered = filtered.filter((activity) => {
        const activityModuleId = activity.moduleId ?? null;
        return activityModuleId === selectedModuleId;
      });
    }

    // Filter by activity type
    if (selectedActivityType) {
      filtered = filtered.filter((activity) => activity.activityType === selectedActivityType);
    }

    // Shuffle if random mode - use stable seed to prevent re-shuffling on every render
    if (randomMode) {
      // Generate seed only once when activities first load or when explicitly shuffling
      const seed = shuffleSeed ?? Math.random();
      if (shuffleSeed === null) {
        setShuffleSeed(seed);
      }
      // Use seed-based shuffle for consistency
      filtered = filtered.sort((a, b) => {
        const hashA = (a.id.charCodeAt(0) + seed) % 1000;
        const hashB = (b.id.charCodeAt(0) + seed) % 1000;
        return hashA - hashB;
      });
    } else {
      // Reset seed when not in random mode
      if (shuffleSeed !== null) {
        setShuffleSeed(null);
      }
    }

    // Only reset index if activities list actually changed (not just re-render)
    setActivities((prev) => {
      const activitiesChanged = prev.length !== filtered.length || 
        prev.some((p, i) => p.id !== filtered[i]?.id);
      if (activitiesChanged) {
        setCurrentIndex(0);
      }
      return filtered;
    });
  }, [allActivities, selectedModuleId, selectedActivityType, randomMode, shuffleSeed]);

  const handleNext = () => {
    if (currentIndex < activities.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success("All activities have been completed!");
      // Optionally reshuffle and restart
      if (randomMode) {
        filterActivities();
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleShuffle = () => {
    setRandomMode(true);
    setShuffleSeed(Math.random()); // Generate new seed when explicitly shuffling
    filterActivities();
  };

  // Memoize callbacks to prevent infinite loops - must be at top level before any conditional returns
  // Use functional updates to access current state without dependencies
  const handleAnswerChange = useCallback((answers: any) => {
    // Store answer as user types (not submitted yet)
    setActivityStates((prev) => {
      // Get current activity ID from activities array and currentIndex
      const currentAct = activities[currentIndex];
      if (!currentAct) return prev;
      
      const currentState = prev[currentAct.id];
      // Only update if the answer actually changed
      if (currentState?.answers === answers) return prev;
      
      return {
        ...prev,
        [currentAct.id]: {
          answers,
          submitted: currentState?.submitted || false,
          score: currentState?.score || null,
          attemptNumber: currentState?.attemptNumber || 0,
          answersRevealed: currentState?.answersRevealed || false,
        },
      };
    });
  }, [activities, currentIndex]);

  const handleComplete = useCallback(async (score: number | null) => {
    // Store submitted state and score, then fetch actual attempt count from database
    const currentAct = activities[currentIndex];
    if (!currentAct) return;
    
    // First update with incremented number (optimistic update)
    setActivityStates((prev) => {
      const currentState = prev[currentAct.id];
      const newAttemptNumber = (currentState?.attemptNumber || 0) + 1;
      
      return {
        ...prev,
        [currentAct.id]: {
          ...prev[currentAct.id],
          submitted: true,
          score,
          attemptNumber: newAttemptNumber,
          answersRevealed: false, // Don't reveal answers automatically
        },
      };
    });
    
    // Then fetch actual count from database to ensure accuracy
    try {
      const attemptsResult = await getLearningActivityAttempts(currentAct.id);
      if (attemptsResult.success && attemptsResult.data && Array.isArray(attemptsResult.data)) {
        const actualAttemptCount = attemptsResult.data.length;
        setActivityStates((prev) => ({
          ...prev,
          [currentAct.id]: {
            ...prev[currentAct.id],
            attemptNumber: actualAttemptCount,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching attempt count:", error);
      // Keep the optimistic update if fetch fails
    }
  }, [activities, currentIndex]);
  
  const handleRevealAnswers = useCallback(() => {
    // Reveal answers for current activity
    setActivityStates((prev) => {
      const currentAct = activities[currentIndex];
      if (!currentAct) return prev;
      
      return {
        ...prev,
        [currentAct.id]: {
          ...prev[currentAct.id],
          answersRevealed: true,
        },
      };
    });
  }, [activities, currentIndex]);

  const handleReset = useCallback(() => {
    // Clear state for current activity, but keep attempt number for display
    setActivityStates((prev) => {
      const currentAct = activities[currentIndex];
      if (!currentAct) return prev;
      
      const currentState = prev[currentAct.id];
      // Keep attempt number but clear answers and submission status
      return {
        ...prev,
        [currentAct.id]: {
          answers: null,
          submitted: false,
          score: null,
          attemptNumber: currentState?.attemptNumber || 0, // Keep attempt number
          answersRevealed: false,
        },
      };
    });
  }, [activities, currentIndex]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="h-96 w-full bg-muted animate-pulse rounded-lg" />
        <div className="flex justify-between">
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activities available at the moment.</p>
          {(selectedModuleId || selectedActivityType) && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSelectedModuleId(null);
                setSelectedActivityType(null);
              }}
            >
              Reset filters
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentActivity = activities[currentIndex];

  if (!currentActivity) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activities available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <Select
            value={selectedModuleId || "all"}
            onValueChange={(value) => setSelectedModuleId(value === "all" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {(modules ?? []).map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  {module.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Select
            value={selectedActivityType || "all"}
            onValueChange={(value) => setSelectedActivityType(value === "all" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {availableActivityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {ACTIVITY_TYPE_LABELS[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleShuffle} size="icon" title="Shuffle">
          <Shuffle className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Are you sure you want to reset all answers? This action cannot be undone.")) {
              setActivityStates({});
              toast.success("All answers have been reset");
            }
          }}
          title="Reset all answers"
        >
          Reset all
        </Button>
      </div>

      {/* Activity Counter */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Activity {currentIndex + 1} of {activities.length}
        </div>
        {currentActivity.module && (
          <Badge variant="secondary">{currentActivity.module.title}</Badge>
        )}
      </div>

      {/* Activity Player */}
      <LearningActivityPlayer
        activity={currentActivity}
        initialAnswer={activityStates[currentActivity.id]?.answers || null}
        initialSubmitted={activityStates[currentActivity.id]?.submitted || false}
        initialScore={activityStates[currentActivity.id]?.score || null}
        attemptNumber={activityStates[currentActivity.id]?.attemptNumber || 0}
        answersRevealed={activityStates[currentActivity.id]?.answersRevealed || false}
        onAnswerChange={handleAnswerChange}
        onComplete={handleComplete}
        onNext={handleNext}
        onReset={handleReset}
        onRevealAnswers={handleRevealAnswers}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          {currentIndex + 1} / {activities.length}
        </div>
        <Button
          variant="outline"
          onClick={handleNext}
          disabled={currentIndex === activities.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

