"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Target, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { getStudyPlanAnalyticsAction } from "@/app/actions/admin-analytics-enhanced";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StudyPlanAnalyticsProps {
  courseId: string;
}

export function StudyPlanAnalytics({ courseId }: StudyPlanAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getStudyPlanAnalyticsAction(courseId);

      if (result.success) {
        setAnalyticsData(result.data);
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

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const aggregate = analyticsData?.aggregate;
  const individual = analyticsData?.individual || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics du plan d'étude</h2>
          <p className="text-muted-foreground">
            Taux d'adhésion et complétion par phase
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Aggregate Statistics */}
      {aggregate && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Étudiants avec plan</CardDescription>
              <CardTitle className="text-2xl">{aggregate.totalStudents}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taux d'adhésion moyen</CardDescription>
              <CardTitle className="text-2xl">
                {aggregate.averageAdherence.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={aggregate.averageAdherence} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Phase 1 complétion moyenne</CardDescription>
              <CardTitle className="text-2xl">
                {aggregate.averagePhase1Complete.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={aggregate.averagePhase1Complete} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Phase 3 complétion moyenne</CardDescription>
              <CardTitle className="text-2xl">
                {aggregate.averagePhase3Complete.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={aggregate.averagePhase3Complete} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual Student Performance */}
      {individual.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance individuelle
            </CardTitle>
            <CardDescription>
              Détails par étudiant sur l'adhésion au plan et la complétion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Étudiant</TableHead>
                    <TableHead>Taux d'adhésion</TableHead>
                    <TableHead>Phase 1</TableHead>
                    <TableHead>Sessions révision</TableHead>
                    <TableHead>Phase 3</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individual.map((student: any) => (
                    <TableRow key={student.userId}>
                      <TableCell className="font-medium">{student.userName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.adherenceRate} className="w-20" />
                          <span className="text-sm">{student.adherenceRate.toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {student.tasksCompletedOnTime} à temps, {student.tasksCompletedLate}{" "}
                          en retard, {student.tasksSkipped} ignorées
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.phase1Complete} className="w-20" />
                          <span className="text-sm">{student.phase1Complete.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.reviewSessions}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.phase3Complete} className="w-20" />
                          <span className="text-sm">{student.phase3Complete.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.adherenceRate >= 80 ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Excellent
                          </span>
                        ) : student.adherenceRate >= 60 ? (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Clock className="h-4 w-4" />
                            Bon
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            À améliorer
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

