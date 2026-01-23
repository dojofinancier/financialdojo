"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CourseMetricsTableProps {
  data: Array<{
    courseId: string;
    courseTitle: string;
    enrollmentCount: number;
    totalContentItems: number;
    completedItems: number;
    averageCompletionRate: number;
    totalTimeSpent: number;
    averageTimeSpent: number;
  }>;
}

export function CourseMetricsTable({ data }: CourseMetricsTableProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cours</TableHead>
            <TableHead>Inscriptions</TableHead>
            <TableHead>Contenu total</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Completion rate</TableHead>
            <TableHead>Temps total</TableHead>
            <TableHead>Temps moyen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((course) => (
              <TableRow key={course.courseId}>
                <TableCell className="font-medium">{course.courseTitle}</TableCell>
                <TableCell>{course.enrollmentCount}</TableCell>
                <TableCell>{course.totalContentItems}</TableCell>
                <TableCell>{course.completedItems}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      course.averageCompletionRate >= 70
                        ? "default"
                        : course.averageCompletionRate >= 40
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {course.averageCompletionRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell>{formatTime(course.totalTimeSpent)}</TableCell>
                <TableCell>{formatTime(course.averageTimeSpent)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

