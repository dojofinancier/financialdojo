"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, CheckCircle2, Target } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { getCaseStudiesAction, getCaseStudyAttemptsAction } from "@/app/actions/case-studies";

interface CaseStudyListProps {
  courseId: string;
  onStartCaseStudy: (caseStudyId: string) => void;
}

type CaseStudy = {
  id: string;
  caseId: string;
  caseNumber: number;
  title: string;
  theme: string | null;
  passingScore: number;
  _count: {
    questions: number;
  };
  latestAttempt: {
    id: string;
    score: number;
    passed: boolean;
    completedAt: Date;
  } | null;
  attemptCount: number;
};

export function CaseStudyList({ courseId, onStartCaseStudy }: CaseStudyListProps) {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCaseStudies = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCaseStudiesAction(courseId);
      if (result.success && result.data) {
        const studies = result.data as any[];
        
        // Load attempt data for each case study
        const studiesWithAttempts = await Promise.all(
          studies.map(async (study) => {
            const attemptsResult = await getCaseStudyAttemptsAction(study.id);
            const attempts = attemptsResult.success && attemptsResult.data ? attemptsResult.data : [];
            const latestAttempt = attempts.length > 0 ? attempts[0] : null;
            
            return {
              ...study,
              latestAttempt: latestAttempt ? {
                id: latestAttempt.id,
                score: latestAttempt.score,
                passed: latestAttempt.passed,
                completedAt: new Date(latestAttempt.completedAt),
              } : null,
              attemptCount: attempts.length,
            };
          })
        );
        
        setCaseStudies(studiesWithAttempts);
      } else {
        setCaseStudies([]);
        if (result.error) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      console.error("Error loading case studies:", error);
      setCaseStudies([]);
      toast.error("Error loading case studies");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCaseStudies();
  }, [loadCaseStudies]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (caseStudies.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No case studies available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {caseStudies.map((caseStudy) => (
        <Card key={caseStudy.id}>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">

                <CardTitle className="text-lg">{caseStudy.title}</CardTitle>
                {caseStudy.theme && (
                  <CardDescription className="mt-2">{caseStudy.theme}</CardDescription>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {caseStudy._count.questions} questions
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {caseStudy.passingScore}% to pass
                  </div>
                </div>
                {caseStudy.latestAttempt && (
                  <div className="mt-3">
                    <Badge
                      variant={caseStudy.latestAttempt.passed ? "default" : "destructive"}
                      className="mr-2"
                    >
                      Latest attempt: {caseStudy.latestAttempt.score}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(caseStudy.latestAttempt.completedAt, "d MMM yyyy", { locale: enCA })}
                    </span>
                  </div>
                )}
                {caseStudy.attemptCount > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {caseStudy.attemptCount} attempt{caseStudy.attemptCount > 1 ? "s" : ""} total
                  </div>
                )}
              </div>
              <Button className="w-full sm:w-auto" onClick={() => onStartCaseStudy(caseStudy.id)}>
                <Play className="h-4 w-4 mr-2" />
                {caseStudy.latestAttempt ? "Resume" : "Start"}
              </Button>

            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
