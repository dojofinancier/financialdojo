"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";
import { Calendar, Clock, TrendingUp, Loader2 } from "lucide-react";

// Dynamically import recharts to reduce initial bundle size
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

interface StudyHabitsSectionProps {
  data: {
    studyTimeByDay: Array<{
      day: number;
      dayName: string;
      timeSpent: number;
    }>;
    studyTimeByHour: Array<{
      hour: number;
      timeSpent: number;
    }>;
    dailyStudyTime: Array<{
      date: string;
      time: number;
    }>;
    weeklyStudyTime: Array<{
      week: string;
      timeSpent: number;
    }>;
    studyPlanAdherence: {
      tasksCompletedOnTime: number;
      tasksCompletedLate: number;
      tasksSkipped: number;
      adherenceRate: number;
    };
    recommendedHours: {
      min: number;
      max: number;
    };
  };
}

export function StudyHabitsSection({ data }: StudyHabitsSectionProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const formatTimeHours = (seconds: number): number => {
    return Math.round((seconds / 3600) * 10) / 10;
  };

  // Calculate average weekly study time
  const averageWeeklyTime = data.weeklyStudyTime.length > 0
    ? data.weeklyStudyTime.reduce((sum, week) => sum + week.timeSpent, 0) / data.weeklyStudyTime.length
    : 0;

  const averageWeeklyHours = formatTimeHours(averageWeeklyTime);

  return (
    <div className="space-y-6">
      {/* Study Time by Day of Week */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Study time by day of the week
          </CardTitle>
          <CardDescription>Breakdown of your study time across the week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.studyTimeByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dayName" />
              <YAxis />
              <Tooltip formatter={(value) => formatTime(Number(value))} />
              <Legend />
              <Bar dataKey="timeSpent" fill="#8884d8" name="Study time" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Study Time (Last 30 Days) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily study time (last 30 days)
          </CardTitle>
          <CardDescription>Trend of your daily study time</CardDescription>
        </CardHeader>
        <CardContent>
          {data.dailyStudyTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyStudyTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatTime(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="time" stroke="#8884d8" name="Study time" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data available for the last 30 days
            </p>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary & Study Plan Adherence */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Weekly summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">{averageWeeklyHours}h</p>
                 <p className="text-xs text-muted-foreground">Average time per week</p>
              </div>
              <div className="pt-3 border-t">
                 <p className="text-sm font-medium mb-2">Recommendation</p>
                <p className="text-xs text-muted-foreground">
                   {data.recommendedHours.min} - {data.recommendedHours.max} hours per week
                </p>
                {averageWeeklyHours < data.recommendedHours.min && (
                  <p className="text-xs text-yellow-600 mt-1">
                     ⚠️ Below the minimum recommendation
                  </p>
                )}
                {averageWeeklyHours >= data.recommendedHours.min &&
                  averageWeeklyHours <= data.recommendedHours.max && (
                    <p className="text-xs text-green-600 mt-1">✓ Within the recommended range</p>
                  )}
                {averageWeeklyHours > data.recommendedHours.max && (
                  <p className="text-xs text-blue-600 mt-1">
                     ℹ️ Above the recommendation (excellent!)
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Study plan adherence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">{data.studyPlanAdherence.adherenceRate.toFixed(1)}%</p>
                 <p className="text-xs text-muted-foreground">Adherence rate</p>
              </div>
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between text-sm">
                   <span className="text-green-600">On time</span>
                  <span>{data.studyPlanAdherence.tasksCompletedOnTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-yellow-600">Late</span>
                  <span>{data.studyPlanAdherence.tasksCompletedLate}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-red-600">Skipped</span>
                  <span>{data.studyPlanAdherence.tasksSkipped}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
