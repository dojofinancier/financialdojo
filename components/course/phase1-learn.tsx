"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Circle, Play } from "lucide-react";
import { getModuleProgressAction } from "@/app/actions/study-plan";
import { LearnStatus } from "@prisma/client";
import { ModuleDetailPage } from "./module-detail-page";

interface Phase1LearnProps {
  courseId: string;
  course: any;
  settings: any;
  onModuleSelect?: (moduleId: string) => void;
}

export function Phase1Learn({ courseId, course, settings, onModuleSelect }: Phase1LearnProps) {
  const [moduleProgress, setModuleProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  useEffect(() => {
    loadProgress();
  }, [courseId]);

  const loadProgress = async () => {
    try {
      const result = await getModuleProgressAction(courseId);
      if (result.success && result.data) {
        setModuleProgress(result.data);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartModule = (moduleId: string) => {
    if (onModuleSelect) {
      onModuleSelect(moduleId);
    } else {
      setSelectedModuleId(moduleId);
    }
  };

  const handleBack = () => {
    setSelectedModuleId(null);
    loadProgress(); // Reload progress when going back
  };

  const getStatusIcon = (status: LearnStatus) => {
    switch (status) {
      case LearnStatus.LEARNED:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case LearnStatus.IN_PROGRESS:
        return <Circle className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // If a module is selected, show the module detail page
  if (selectedModuleId) {
    return (
      <ModuleDetailPage
        courseId={courseId}
        moduleId={selectedModuleId}
        onBack={handleBack}
        componentVisibility={course?.componentVisibility as any}
      />
    );
  }

  if (loading) {
    return <div>Chargement...</div>;
  }

  const learnedCount = moduleProgress.filter((p) => p.learnStatus === LearnStatus.LEARNED).length;
  const totalCount = moduleProgress.length;
  const progressPercentage = totalCount > 0 ? (learnedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Phase 1 - Apprendre le matériel
          </CardTitle>
          <CardDescription>
            Première passe complète du syllabus. Complétez chaque module et passez les mini-tests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progression globale</span>
                <span className="text-sm text-muted-foreground">
                  {learnedCount} / {totalCount} modules appris
                </span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {moduleProgress.map((progress) => (
          <Card key={progress.moduleId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(progress.learnStatus)}
                  <div>
                    <div className="font-medium">
                      Module {progress.module.order}: {progress.module.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {progress.learnStatus === LearnStatus.LEARNED
                        ? "Appris"
                        : progress.learnStatus === LearnStatus.IN_PROGRESS
                        ? "In progress"
                        : "Not started"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={progress.learnStatus === LearnStatus.LEARNED ? "outline" : "default"}
                    onClick={() => handleStartModule(progress.moduleId)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {progress.learnStatus === LearnStatus.LEARNED ? "Review" : "Commencer"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

