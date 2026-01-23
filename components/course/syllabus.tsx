"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Video, FileText, Play } from "lucide-react";
import { useCourseModules } from "@/lib/hooks/use-learning-activities";
import { useBatchModuleContent } from "@/lib/hooks/use-module-content";

interface Module {
  id: string;
  title: string;
  order: number;
  examWeight: number | null;
}

interface ModuleContent {
  videos: Array<{ id: string; order: number }>;
  notes: Array<{ id: string; order: number }>;
  quizzes: Array<{ id: string; order: number }>;
}

interface SyllabusProps {
  courseId: string;
}

export function Syllabus({ courseId }: SyllabusProps) {
  // Use React Query for modules
  const { data: modulesData, isLoading: modulesLoading } = useCourseModules(courseId);
  const modules = useMemo(() => (modulesData || []) as Module[], [modulesData]);

  // Get module IDs for batch content loading
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);

  // Use React Query for batch module content
  const { data: batchResult, isLoading: contentLoading } = useBatchModuleContent(moduleIds);

  const loading = modulesLoading || contentLoading;

  // Process module contents
  const moduleContents = useMemo(() => {
    if (!batchResult?.success || !batchResult.data) {
      return {} as Record<string, ModuleContent>;
    }
    return batchResult.data as Record<string, ModuleContent>;
  }, [batchResult]);


  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Chargement du plan de cours...</p>
        </CardContent>
      </Card>
    );
  }

  if (modules.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucun module disponible pour ce cours.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Course syllabus</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-3">
            {modules.map((module) => {
              const content = moduleContents[module.id] || { videos: [], notes: [], quizzes: [] };
              const hasVideos = content.videos.length > 0;
              const hasNotes = content.notes.length > 0;
              const hasQuizzes = content.quizzes.length > 0;

              return (
                <div key={module.id} className="border rounded-lg p-4 space-y-3">
                  <div className="font-medium text-sm leading-tight">
                    Module {module.order + 1}: {module.title}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground min-w-[50px]">Videos</span>
                      {hasVideos ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            window.location.href = `/learn/${courseId}?module=${module.id}&tab=videos`;
                          }}
                          title={`${content.videos.length} video${content.videos.length > 1 ? 's' : ''}`}
                        >
                          <Video className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground min-w-[50px]">Notes</span>
                      {hasNotes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            window.location.href = `/learn/${courseId}?module=${module.id}&tab=notes`;
                          }}
                          title={`${content.notes.length} note${content.notes.length > 1 ? 's' : ''}`}
                        >
                          <FileText className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground min-w-[50px]">Quiz</span>
                      {hasQuizzes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            window.location.href = `/learn/${courseId}?module=${module.id}&tab=quiz`;
                          }}
                          title={`${content.quizzes.length} quiz${content.quizzes.length > 1 ? 's' : ''}`}
                        >
                          <Play className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                    {module.examWeight !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground min-w-[50px]">Weight</span>
                        <Badge variant="outline" className="text-xs">
                          {(module.examWeight * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center">Videos</TableHead>
                  <TableHead className="text-center">Notes</TableHead>
                  <TableHead className="text-center">Quiz</TableHead>
                  <TableHead className="text-center">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module) => {
                  const content = moduleContents[module.id] || { videos: [], notes: [], quizzes: [] };
                  const hasVideos = content.videos.length > 0;
                  const hasNotes = content.notes.length > 0;
                  const hasQuizzes = content.quizzes.length > 0;

                  return (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">
                        Module {module.order + 1}: {module.title}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasVideos ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              window.location.href = `/learn/${courseId}?module=${module.id}&tab=videos`;
                            }}
                            title={`${content.videos.length} video${content.videos.length > 1 ? 's' : ''}`}
                          >
                            <Video className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasNotes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              window.location.href = `/learn/${courseId}?module=${module.id}&tab=notes`;
                            }}
                            title={`${content.notes.length} note${content.notes.length > 1 ? 's' : ''}`}
                          >
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasQuizzes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              window.location.href = `/learn/${courseId}?module=${module.id}&tab=quiz`;
                            }}
                            title={`${content.quizzes.length} quiz${content.quizzes.length > 1 ? 's' : ''}`}
                          >
                            <Play className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {module.examWeight !== null ? (
                          <Badge variant="outline">
                            {(module.examWeight * 100).toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
