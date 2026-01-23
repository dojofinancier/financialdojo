"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle, TrendingDown, Users } from "lucide-react";
import { getDropOffAnalysisAction } from "@/app/actions/admin-analytics-enhanced";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface DropOffAnalysisProps {
  courseId: string;
}

export function DropOffAnalysis({ courseId }: DropOffAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getDropOffAnalysisAction(courseId);

      if (result.success) {
        setAnalysisData(result.data);
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

  if (loading && !analysisData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const atRiskStudents = analysisData?.individual?.filter((s: any) => s.isAtRisk) || [];
  const commonDropOffPoints = analysisData?.commonDropOffPoints || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Drop-off analysis</h2>
          <p className="text-muted-foreground">
            Common drop-off points and at-risk students
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>At-risk students</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {analysisData?.atRiskStudents || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Inactive for more than 14 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average time to drop-off</CardDescription>
            <CardTitle className="text-2xl">
              {analysisData?.averageTimeToDropOff
                ? Math.round(analysisData.averageTimeToDropOff)
                : 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total students</CardDescription>
            <CardTitle className="text-2xl">{analysisData?.totalStudents || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">In this course</p>
          </CardContent>
        </Card>
      </div>

      {/* Common Drop-off Points */}
      {commonDropOffPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Common drop-off points
            </CardTitle>
            <CardDescription>
              Modules where students stop most often
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {commonDropOffPoints.map((point: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{point.module}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{point.count}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-Risk Students */}
      {atRiskStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              At-risk students
            </CardTitle>
            <CardDescription>
              Students inactive for more than 14 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead>Days inactive</TableHead>
                    <TableHead>Last module</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRiskStudents.map((student: any) => (
                    <TableRow key={student.userId}>
                      <TableCell className="font-medium">{student.userEmail}</TableCell>
                      <TableCell>
                        {student.lastActivity
                          ? format(new Date(student.lastActivity), "d MMM yyyy", { locale: enUS })
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {student.daysSinceLastActivity} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.lastModule
                          ? `Module ${student.lastModule.order}: ${student.lastModule.title}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.completionRate} className="w-20" />
                          <span className="text-sm">{student.completionRate.toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {student.modulesLearned} / {student.totalModules} modules
                        </div>
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

