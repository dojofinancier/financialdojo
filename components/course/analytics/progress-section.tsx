"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Calendar, BookOpen, Target } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

interface ProgressSectionProps {
  data: {
    moduleProgress: Array<{
      moduleId: string;
      moduleTitle: string;
      moduleOrder: number;
      learnStatus: string;
      lastLearnedAt: Date | null;
      lastReviewedAt: Date | null;
      memoryStrength: number | null;
      errorRate: number | null;
    }>;
    phase1: {
      completed: number;
      total: number;
      percentage: number;
    };
    phase2: {
      totalItemsReviewed: number;
    };
    phase3: {
      completed: number;
      total: number;
      percentage: number;
    };
    lastActivity: Date | null;
    timeSpent: number;
    upcomingTasks: Array<{
      id: string;
      date: Date;
      taskType: string;
      status: string;
      moduleTitle: string | null;
    }>;
  };
}

export function ProgressSection({ data }: ProgressSectionProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LEARNED":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="secondary">In progress</Badge>;
      default:
        return <Badge variant="outline">Not started</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Phase Progress */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Phase 1 - Learning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Modules completed</span>
                <span>{data.phase1.completed} / {data.phase1.total}</span>
              </div>
              <Progress value={data.phase1.percentage} />
              <p className="text-xs text-muted-foreground">
                {data.phase1.percentage.toFixed(1)}% completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Phase 2 - Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{data.phase2.totalItemsReviewed}</p>
              <p className="text-xs text-muted-foreground">
                Items reviewed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-4 w-4" />
              Phase 3 - Practice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Practice exams</span>
                <span>{data.phase3.completed} / {data.phase3.total}</span>
              </div>
              <Progress value={data.phase3.percentage} />
              <p className="text-xs text-muted-foreground">
                {data.phase3.percentage.toFixed(1)}% completed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progress by module</CardTitle>
          <CardDescription>Completion status of each module</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(data.moduleProgress || []).map((module) => (
              <div key={module.moduleId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">Module {module.moduleOrder}: {module.moduleTitle}</span>
                    {getStatusBadge(module.learnStatus)}
                  </div>
                  {module.lastLearnedAt && (
                    <p className="text-xs text-muted-foreground">
                      Completed on {format(new Date(module.lastLearnedAt), "d MMMM yyyy", { locale: enCA })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Upcoming Tasks */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Latest activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lastActivity ? (
              <p className="text-sm">
                {format(new Date(data.lastActivity), "d MMMM yyyy 'at' HH:mm", { locale: enCA })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Total time: {formatTime(data.timeSpent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingTasks && data.upcomingTasks.length > 0 ? (
              <div className="space-y-2">
                {data.upcomingTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="text-sm">
                    <p className="font-medium">
                      {format(new Date(task.date), "d MMM", { locale: enCA })} - {task.moduleTitle || "Task"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.taskType.toLowerCase()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming tasks</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

