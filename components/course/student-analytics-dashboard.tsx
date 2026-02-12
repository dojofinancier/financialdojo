"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Clock, Target, TrendingUp, BookOpen, Calendar, Award } from "lucide-react";
import {
  getStudentOverviewAction,
  getStudentProgressAction,
  getStudentPerformanceAction,
  getStudentStudyHabitsAction,
  getStudentGoalsAction,
} from "@/app/actions/student-analytics";
import { OverviewSection } from "./analytics/overview-section";
import { ProgressSection } from "./analytics/progress-section";
import { PerformanceSection } from "./analytics/performance-section";
import { StudyHabitsSection } from "./analytics/study-habits-section";
import { GoalsSection } from "./analytics/goals-section";

interface StudentAnalyticsDashboardProps {
  courseId: string;
}

export function StudentAnalyticsDashboard({ courseId }: StudentAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [overviewData, setOverviewData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [studyHabitsData, setStudyHabitsData] = useState<any>(null);
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [goalsData, setGoalsData] = useState<any>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);

  // Load overview immediately
  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Load other tabs when they become active
  useEffect(() => {
    if (activeTab === "progress" && !progressData && !progressLoading) {
      loadProgress();
    } else if (activeTab === "performance" && !performanceData && !performanceLoading) {
      loadPerformance();
    } else if (activeTab === "habits" && !studyHabitsData && !habitsLoading) {
      loadHabits();
    } else if (activeTab === "goals" && !goalsData && !goalsLoading) {
      loadGoals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const result = await getStudentOverviewAction(courseId);
      if (result.success) {
        setOverviewData(result.data);
      } else {
        console.error("Overview error:", result.error);
      }
    } catch (error) {
      console.error("Error loading overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    setProgressLoading(true);
    try {
      const result = await getStudentProgressAction(courseId);
      if (result.success) {
        setProgressData(result.data);
      } else {
        console.error("Progress error:", result.error);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setProgressLoading(false);
    }
  };

  const loadPerformance = async () => {
    setPerformanceLoading(true);
    try {
      const result = await getStudentPerformanceAction(courseId);
      if (result.success) {
        setPerformanceData(result.data);
      } else {
        console.error("Performance error:", result.error);
      }
    } catch (error) {
      console.error("Error loading performance:", error);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const loadHabits = async () => {
    setHabitsLoading(true);
    try {
      const result = await getStudentStudyHabitsAction(courseId);
      if (result.success) {
        setStudyHabitsData(result.data);
      } else {
        console.error("Habits error:", result.error);
      }
    } catch (error) {
      console.error("Error loading habits:", error);
    } finally {
      setHabitsLoading(false);
    }
  };

  const loadGoals = async () => {
    setGoalsLoading(true);
    try {
      const result = await getStudentGoalsAction(courseId);
      if (result.success) {
        setGoalsData(result.data);
      } else {
        console.error("Goals error:", result.error);
      }
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setGoalsLoading(false);
    }
  };

  if (loading && !overviewData) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto sm:grid sm:w-full sm:grid-cols-5 h-auto gap-1 sm:gap-0">
            <TabsTrigger value="overview" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-3 sm:px-3 whitespace-nowrap flex-shrink-0">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-3 sm:px-3 whitespace-nowrap flex-shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Progress</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-3 sm:px-3 whitespace-nowrap flex-shrink-0">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-3 sm:px-3 whitespace-nowrap flex-shrink-0">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Habits</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-1.5 text-xs sm:text-sm px-3 sm:px-3 whitespace-nowrap flex-shrink-0">
              <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>Goals</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6">
          {overviewData ? (
            <OverviewSection data={overviewData} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          {progressLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : progressData ? (
            <ProgressSection data={progressData} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          {performanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : performanceData ? (
            <PerformanceSection data={performanceData} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="habits" className="mt-6">
          {habitsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : studyHabitsData ? (
            <StudyHabitsSection data={studyHabitsData} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          {goalsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : goalsData ? (
            <GoalsSection data={goalsData} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

