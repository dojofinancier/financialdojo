"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Award, CheckCircle2, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

interface GoalsSectionProps {
  data: {
    hasStudyPlan: boolean;
    goals: {
      totalBlocks: number;
      completedBlocks: number;
      percentage: number;
      daysUntilExam: number;
      examDate: Date;
      onTrack: boolean;
    } | null;
    milestones: Array<{
      id: string;
      title: string;
      description: string;
      achievedAt: Date | null;
    }>;
    achievements: Array<{
      id: string;
      title: string;
      description: string;
      achieved: boolean;
    }>;
  };
}

export function GoalsSection({ data }: GoalsSectionProps) {
  if (!data.hasStudyPlan || !data.goals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No study plan</CardTitle>
          <CardDescription>
            Set up a study plan to see your goals and progress
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Study Plan Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Study plan goals
          </CardTitle>
          <CardDescription>Progress toward your exam</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Blocks completed</span>
                <span>
                  {data.goals.completedBlocks} / {data.goals.totalBlocks}
                </span>
              </div>
              <Progress value={data.goals.percentage} />
              <p className="text-xs text-muted-foreground mt-1">
                {data.goals.percentage.toFixed(1)}% completed
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <div>
                <p className="text-sm font-medium mb-1">Days until exam</p>
                <p className="text-2xl font-bold">{data.goals.daysUntilExam}</p>
                <p className="text-xs text-muted-foreground">
                  Date: {format(new Date(data.goals.examDate), "d MMMM yyyy", { locale: enCA })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Status</p>
                {data.goals.onTrack ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    On track
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <Clock className="h-3 w-3 mr-1" />
                    Behind
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Milestones
          </CardTitle>
          <CardDescription>Key steps along your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  milestone.achievedAt ? "bg-green-50 dark:bg-green-950" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {milestone.achievedAt ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <p className="font-medium">{milestone.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>
                  {milestone.achievedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Achieved on {format(new Date(milestone.achievedAt), "d MMMM yyyy", { locale: enCA })}
                    </p>
                  )}
                </div>
                {milestone.achievedAt ? (
                  <Badge variant="default" className="bg-green-500">
                    Achieved
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription>Badges and accomplishments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {data.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-3 border rounded-lg ${
                  achievement.achieved ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {achievement.achieved ? (
                    <Award className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <Award className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p className="font-medium">{achievement.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                {achievement.achieved && (
                  <Badge variant="outline" className="mt-2 bg-yellow-100 dark:bg-yellow-900">
                    Unlocked
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

