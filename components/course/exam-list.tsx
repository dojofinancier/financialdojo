"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Target, FileText, Play, CheckCircle2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAvailableExams } from "@/lib/hooks/use-exams";

interface ExamListProps {
  courseId: string;
  onStartExam: (examId: string) => void;
}

type Exam = {
  id: string;
  title: string;
  timeLimit: number | null;
  passingScore: number;
  examFormat: string | null;
  _count: {
    questions: number;
  };
  latestAttempt: {
    id: string;
    score: number;
    completedAt: Date;
  } | null;
  attemptCount: number;
};

export function ExamList({ courseId, onStartExam }: ExamListProps) {
  const { data: result, isLoading: loading, error } = useAvailableExams(courseId);
  
  const exams = result?.success && result.data ? result.data : [];
  
  if (error) {
    toast.error("Error loading exams");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucun examen simulé disponible pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {exams.map((exam) => (
        <Card key={exam.id}>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">

                <CardTitle className="text-lg">{exam.title}</CardTitle>
                {exam.examFormat && (
                  <CardDescription className="mt-2">{exam.examFormat}</CardDescription>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {exam._count.questions} questions
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {exam.timeLimit ? `${Math.floor(exam.timeLimit / 60)} minutes` : "Sans limite"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {exam.passingScore}% pour réussir
                  </div>
                </div>
                {exam.latestAttempt && (
                  <div className="mt-3">
                    <Badge
                      variant={exam.latestAttempt.score >= exam.passingScore ? "default" : "destructive"}
                      className="mr-2"
                    >
                      Dernière tentative: {exam.latestAttempt.score}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(exam.latestAttempt.completedAt), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                )}
                {exam.attemptCount > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {exam.attemptCount} tentative{exam.attemptCount > 1 ? "s" : ""} au total
                  </div>
                )}
              </div>
              <Button className="w-full sm:w-auto" onClick={() => onStartExam(exam.id)}>
                <Play className="h-4 w-4 mr-2" />
                {exam.latestAttempt ? "Reprendre" : "Commencer"}
              </Button>

            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

