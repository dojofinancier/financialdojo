"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getEnrollmentStatisticsAction,
  getDetailedCompletionRatesAction,
  getUserEngagementAction,
  getCourseMetricsAction,
} from "@/app/actions/analytics";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users, BookOpen, TrendingUp, Clock, Activity, Target, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnrollmentChart } from "./enrollment-chart";
import { CompletionRatesChart } from "./completion-rates-chart";
import { CourseMetricsTable } from "./course-metrics-table";
import { StudentUsagePatterns } from "./student-usage-patterns";
import { ContentEngagement } from "./content-engagement";
import { StudyPlanAnalytics } from "./study-plan-analytics";
import { DropOffAnalysis } from "./drop-off-analysis";
import { getCoursesAction } from "@/app/actions/courses";

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [enrollmentStats, setEnrollmentStats] = useState<any>(null);
  const [completionRates, setCompletionRates] = useState<any>(null);
  const [userEngagement, setUserEngagement] = useState<any>(null);
  const [courseMetrics, setCourseMetrics] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enrollmentResult, completionResult, engagementResult, metricsResult] =
        await Promise.all([
          getEnrollmentStatisticsAction(),
          getDetailedCompletionRatesAction(),
          getUserEngagementAction(),
          getCourseMetricsAction(),
        ]);

      if (enrollmentResult.success) setEnrollmentStats(enrollmentResult.data);
      if (completionResult.success) setCompletionRates(completionResult.data);
      if (engagementResult.success) setUserEngagement(engagementResult.data);
      if (metricsResult.success) setCourseMetrics(metricsResult.data);
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCourses = async () => {
    try {
      const result = await getCoursesAction({ limit: 100 });
      if (result && result.items) {
        setCourses(result.items.map((c: any) => ({ id: c.id, title: c.title })));
        if (result.items.length > 0 && !selectedCourseId) {
          setSelectedCourseId(result.items[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading courses:", error);
    }
  };

  if (loading && !enrollmentStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Selector for Enhanced Analytics */}
      {(activeTab === "usage" || activeTab === "content" || activeTab === "study-plan" || activeTab === "drop-off") && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Cours:</label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <BookOpen className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="usage">
            <Activity className="h-4 w-4 mr-2" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="content">
            <TrendingUp className="h-4 w-4 mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger value="study-plan">
            <Target className="h-4 w-4 mr-2" />
            Study plan
          </TabsTrigger>
          <TabsTrigger value="drop-off">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Drop-off
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total enrollments</CardDescription>
            <CardTitle className="text-2xl">
              {enrollmentStats?.totalEnrollments || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Active: {enrollmentStats?.activeEnrollments || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Expired: {enrollmentStats?.expiredEnrollments || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active users</CardDescription>
            <CardTitle className="text-2xl">
              {userEngagement?.activeUsers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total: {userEngagement?.totalUsers || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Last 30 days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average completion rate</CardDescription>
            <CardTitle className="text-2xl">
              {completionRates && completionRates.length > 0
                ? (
                    completionRates.reduce(
                      (sum: number, c: any) => sum + c.averageCompletionRate,
                      0
                    ) / completionRates.length
                  ).toFixed(1)
                : "0.0"}
              %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              All courses
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average time per student</CardDescription>
            <CardTitle className="text-2xl">
              {userEngagement?.averageTimeSpent
                ? Math.round(userEngagement.averageTimeSpent / 60)
                : 0}
              min
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total time spent
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollments by course</CardTitle>
            <CardDescription>Top 10 courses by enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentStats?.enrollmentsByCourse ? (
              <EnrollmentChart data={enrollmentStats.enrollmentsByCourse.slice(0, 10)} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion rate by course</CardTitle>
            <CardDescription>Average completion percentage</CardDescription>
          </CardHeader>
          <CardContent>
            {completionRates ? (
              <CompletionRatesChart data={completionRates} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course Metrics Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course metrics</CardTitle>
              <CardDescription>
                Enrollment, completion, and engagement details
              </CardDescription>
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {courseMetrics ? (
            <CourseMetricsTable data={courseMetrics} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          {selectedCourseId ? (
            <StudentUsagePatterns courseId={selectedCourseId} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Select a course to view the data</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          {selectedCourseId ? (
            <ContentEngagement courseId={selectedCourseId} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Select a course to view the data</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="study-plan" className="mt-6">
          {selectedCourseId ? (
            <StudyPlanAnalytics courseId={selectedCourseId} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Select a course to view the data</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="drop-off" className="mt-6">
          {selectedCourseId ? (
            <DropOffAnalysis courseId={selectedCourseId} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Select a course to view the data</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

