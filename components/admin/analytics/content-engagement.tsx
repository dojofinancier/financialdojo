"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Eye, BookOpen } from "lucide-react";
import { getContentEngagementAction } from "@/app/actions/admin-analytics-enhanced";
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

interface ContentEngagementProps {
  courseId: string;
}

export function ContentEngagement({ courseId }: ContentEngagementProps) {
  const [loading, setLoading] = useState(true);
  const [engagementData, setEngagementData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getContentEngagementAction(courseId);

      if (result.success) {
        setEngagementData(result.data);
      } else {
        toast.error(result.error || "Error loading");
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
  }, [courseId]);

  if (loading && !engagementData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prepare module engagement data for chart
  const moduleEngagementData = engagementData?.moduleEngagement
    ? engagementData.moduleEngagement.map((m: any) => ({
        module: `Module ${m.moduleOrder}`,
        views: m.totalViews,
        completion: m.completionRate.toFixed(1),
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Engagement du contenu</h2>
          <p className="text-muted-foreground">
            Analyse de l'engagement par module et contenu
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Module Engagement */}
      {moduleEngagementData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Module engagement
            </CardTitle>
            <CardDescription>
              View count and completion rate per module
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleEngagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="module" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="views" fill="#8884d8" name="Views" />
                <Bar yAxisId="right" dataKey="completion" fill="#82ca9d" name="Completion (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Most Viewed Videos */}
      {engagementData?.mostViewedVideos && engagementData.mostViewedVideos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Most watched videos
            </CardTitle>
            <CardDescription>Top 10 videos by view count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {engagementData.mostViewedVideos.slice(0, 10).map((video: any, index: number) => (
                <div
                  key={video.contentItemId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{video.moduleTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(video.totalTimeSpent / 3600)}h total time
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{video.viewCount}</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Attempted Quizzes */}
      {engagementData?.mostAttemptedQuizzes && engagementData.mostAttemptedQuizzes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most attempted quizzes
            </CardTitle>
            <CardDescription>Top 10 quizzes by attempt count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {engagementData.mostAttemptedQuizzes.slice(0, 10).map((quiz: any, index: number) => (
                <div
                  key={quiz.quizId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">Quiz #{index + 1}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{quiz.attemptCount}</p>
                    <p className="text-xs text-muted-foreground">Attempts</p>
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

