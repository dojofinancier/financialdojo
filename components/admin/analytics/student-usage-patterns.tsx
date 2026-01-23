"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Users, Activity, TrendingUp } from "lucide-react";
import {
  getStudentUsagePatternsAction,
  getFeatureUsageAction,
} from "@/app/actions/admin-analytics-enhanced";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamically import recharts to reduce initial bundle size
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

interface StudentUsagePatternsProps {
  courseId?: string;
}

export function StudentUsagePatterns({ courseId }: StudentUsagePatternsProps) {
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<any>(null);
  const [featureData, setFeatureData] = useState<any>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(courseId);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usageResult, featureResult] = await Promise.all([
        getStudentUsagePatternsAction(undefined, selectedCourseId),
        getFeatureUsageAction(selectedCourseId),
      ]);

      if (usageResult.success) {
        setUsageData(usageResult.data);
      } else {
        toast.error(usageResult.error || "Error loading");
      }

      if (featureResult.success) {
        setFeatureData(featureResult.data);
      } else {
        toast.error(featureResult.error || "Error loading");
      }
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  if (loading && !usageData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prepare feature usage data for chart
  const featureUsageData = featureData?.featureUsage
    ? Object.entries(featureData.featureUsage).map(([key, value]: [string, any]) => ({
        feature: key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim(),
        users: value.users,
        percentage: value.percentage,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Student usage</h2>
          <p className="text-muted-foreground">
            Activity patterns and engagement by feature
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Feature Usage */}
      {featureData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Feature usage
            </CardTitle>
            <CardDescription>
              Percentage of students using each feature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total enrolled students: {featureData.totalEnrolled || 0}
              </div>
              {featureUsageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={featureUsageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                    <Legend />
                    <Bar dataKey="percentage" fill="#8884d8" name="% usage" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Scores */}
      {usageData?.engagementScores && usageData.engagementScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement scores
            </CardTitle>
            <CardDescription>
              Top 10 students by engagement score (based on activity, time, completion)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageData.engagementScores.slice(0, 10).map((student: any, index: number) => (
                <div
                  key={student.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{student.userEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.loginCount} active days •{" "}
                        {Math.round(student.studyTime / 3600)}h study time
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{student.engagementScore.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

