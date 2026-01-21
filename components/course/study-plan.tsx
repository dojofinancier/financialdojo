"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { updatePlanEntryStatusAction } from "@/app/actions/study-plan";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PlanEntryStatus } from "@prisma/client";
import { toast } from "sonner";
import { useWeeklyPlan, type WeekData } from "@/lib/hooks/use-weekly-plan";
import { useQueryClient } from "@tanstack/react-query";

interface StudyPlanProps {
  courseId: string;
  refreshKey?: number; // Add refresh key to force reload
}

export function StudyPlan({ courseId, refreshKey }: StudyPlanProps) {
  const queryClient = useQueryClient();
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // Expand first week by default
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set()); // Track tasks being updated
  const [isPending, startTransition] = useTransition(); // For non-blocking updates
  
  const { data: planData, isLoading: loading } = useWeeklyPlan(courseId, refreshKey);
  const weeks = planData?.weeks || [];
  const week1StartDate = planData?.week1StartDate || null;
  const examDate = planData?.examDate || null;

  // Expand current week when data loads
  useEffect(() => {
    if (weeks.length > 0) {
      const today = new Date();
      const currentWeek = weeks.find((week: WeekData) => {
        const start = new Date(week.weekStartDate);
        const end = new Date(week.weekEndDate);
        return today >= start && today <= end;
      });
      if (currentWeek) {
        setExpandedWeeks(new Set([currentWeek.weekNumber]));
      }
    }
  }, [weeks]);

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(weekNumber)) {
        newSet.delete(weekNumber);
      } else {
        newSet.add(weekNumber);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: "PENDING" | "IN_PROGRESS" | "COMPLETED") => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="bg-green-500 text-xs">Complété</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="default" className="bg-blue-500 text-xs">En cours</Badge>;
      case "PENDING":
        return <Badge variant="outline" className="text-xs">En attente</Badge>;
      default:
        return null;
    }
  };

  // Group tasks by type for display
  const groupTasksByType = (tasks: WeekData["tasks"]) => {
    return {
      LEARN: tasks.filter((t) => t.type === "LEARN"),
      REVIEW: tasks.filter((t) => t.type === "REVIEW"),
      PRACTICE: tasks.filter((t) => t.type === "PRACTICE"),
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan d'étude</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Plan d'étude
          </CardTitle>
          <CardDescription>Aucun plan d'étude disponible</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Plan d'étude
          </CardTitle>
          <CardDescription>
            {week1StartDate && examDate && (
              <>
                Du {format(week1StartDate, "d MMMM yyyy", { locale: fr })} au{" "}
                {format(examDate, "d MMMM yyyy", { locale: fr })}
              </>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {weeks.map((week: WeekData) => {
            const weekStart = new Date(week.weekStartDate);
            const weekEnd = new Date(week.weekEndDate);
            weekStart.setHours(0, 0, 0, 0);
            weekEnd.setHours(0, 0, 0, 0);
            
            const isCurrentWeek = today >= weekStart && today <= weekEnd;
            const isPast = weekEnd < today;
            const isExpanded = expandedWeeks.has(week.weekNumber);

            const groupedTasks = groupTasksByType(week.tasks);
            const completionPercentage = week.totalTasks > 0 
              ? Math.round((week.completedTasks / week.totalTasks) * 100) 
              : 0;

            return (
              <Collapsible
                key={week.weekNumber}
                open={isExpanded}
                onOpenChange={() => toggleWeek(week.weekNumber)}
              >
                <div
                  className={`border rounded-lg ${
                    isCurrentWeek ? "bg-primary/5 border-primary" : ""
                  } ${isPast ? "opacity-75" : ""}`}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto hover:bg-transparent"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm sm:text-base">
                            {week.weekNumber}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <h3 className="font-semibold text-base sm:text-lg truncate">
                              Semaine {week.weekNumber}
                            </h3>
                            {isCurrentWeek && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                Cette semaine
                              </Badge>
                            )}
                            {week.weekNumber === weeks.length && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Semaine d'examen
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {format(weekStart, "d MMM", { locale: fr })} -{" "}
                            {format(weekEnd, "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex w-full items-center justify-between text-xs sm:w-auto sm:flex-col sm:items-end sm:text-right sm:ml-2">
                          <div className="text-xs sm:text-sm font-medium whitespace-nowrap">
                            {week.completedTasks} / {week.totalTasks} complété
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {completionPercentage}%
                          </div>
                        </div>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      {/* Learn Tasks */}
                      {groupedTasks.LEARN.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Phase 1 - Apprendre
                          </h4>
                          <div className="space-y-3 sm:space-y-2 ml-0 sm:ml-6">
                            {groupedTasks.LEARN.map((task, index) => (
                              <div
                                key={`${task.moduleId || 'task'}-${index}`}
                                className="p-3 rounded-lg border border-border/60 bg-muted/30 shadow-sm sm:bg-background sm:shadow-none"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <Checkbox
                                      checked={task.status === "COMPLETED"}
                                      disabled={updatingTasks.has(`${task.moduleId}-${index}`) || (task.entryIds !== undefined && task.entryIds.length === 0)}
                                      onCheckedChange={(checked) => {
                                        const taskKey = `${task.moduleId}-${index}`;
                                        setUpdatingTasks(prev => new Set(prev).add(taskKey));
                                        
                                        // Optimistic UI update - update local state immediately
                                        const taskIdentifier = `${task.description}-${task.moduleId || ''}-${index}`;
                                        const previousStatus = task.status;
                                        
                                        // Update UI immediately using React Query cache
                                        queryClient.setQueryData(
                                          ["weekly-plan", courseId, refreshKey],
                                          (oldData: any) => {
                                            if (!oldData) return oldData;
                                            return {
                                              ...oldData,
                                              weeks: oldData.weeks.map((week: WeekData) => ({
                                                ...week,
                                                tasks: week.tasks.map((t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return { ...t, status: checked ? "COMPLETED" : "PENDING" };
                                                  }
                                                  return t;
                                                }),
                                                completedTasks: week.tasks.reduce((count, t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return count + (checked ? 1 : -1);
                                                  }
                                                  return count + (t.status === "COMPLETED" ? 1 : 0);
                                                }, 0),
                                              })),
                                            };
                                          }
                                        );

                                        // Show toast immediately for instant feedback
                                        toast.success(checked ? "Task completed" : "Task reset");

                                        // Update server in background (non-blocking)
                                        startTransition(async () => {
                                          try {
                                            if (task.entryIds && task.entryIds.length > 0) {
                                              const newStatus = checked ? PlanEntryStatus.COMPLETED : PlanEntryStatus.PENDING;
                                              await Promise.all(
                                                task.entryIds.map((entryId: string) =>
                                                  updatePlanEntryStatusAction(entryId, newStatus)
                                                )
                                              );
                                              // Invalidate cache to refetch updated plan in background
                                              queryClient.invalidateQueries({ queryKey: ["weekly-plan", courseId, refreshKey] });
                                            }
                                          } catch (error) {
                                            // Revert on error using React Query cache
                                            queryClient.setQueryData(
                                              ["weekly-plan", courseId, refreshKey],
                                              (oldData: any) => {
                                                if (!oldData) return oldData;
                                                return {
                                                  ...oldData,
                                                  weeks: oldData.weeks.map((week: WeekData) => ({
                                                    ...week,
                                                    tasks: week.tasks.map((t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return { ...t, status: previousStatus };
                                                      }
                                                      return t;
                                                    }),
                                                    completedTasks: week.tasks.reduce((count, t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return count + (previousStatus === "COMPLETED" ? 1 : 0);
                                                      }
                                                      return count + (t.status === "COMPLETED" ? 1 : 0);
                                                    }, 0),
                                                  })),
                                                };
                                              }
                                            );
                                            toast.error("Error updating");
                                          } finally {
                                            setUpdatingTasks(prev => {
                                              const next = new Set(prev);
                                              next.delete(taskKey);
                                              return next;
                                            });
                                          }
                                        });
                                      }}
                                    />
                                    <div className="text-sm font-medium flex-1">
                                      {task.description}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end">
                                    {getStatusBadge(task.status)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review Tasks */}
                      {groupedTasks.REVIEW.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Phase 2 - Réviser
                          </h4>
                          <div className="space-y-3 sm:space-y-2 ml-0 sm:ml-6">
                            {groupedTasks.REVIEW.map((task, index) => (
                              <div
                                key={`review-${index}`}
                                className="p-3 rounded-lg border border-border/60 bg-muted/30 shadow-sm sm:bg-background sm:shadow-none"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <Checkbox
                                      checked={task.status === "COMPLETED"}
                                      disabled={updatingTasks.has(`review-${index}`) || (!task.entryIds || task.entryIds.length === 0)}
                                      onCheckedChange={(checked) => {
                                        const taskKey = `review-${index}`;
                                        setUpdatingTasks(prev => new Set(prev).add(taskKey));
                                        
                                        // Optimistic UI update
                                        const taskIdentifier = `${task.description}-${task.moduleId || ''}-review-${index}`;
                                        const previousStatus = task.status;
                                        
                                        // Update UI immediately using React Query cache
                                        queryClient.setQueryData(
                                          ["weekly-plan", courseId, refreshKey],
                                          (oldData: any) => {
                                            if (!oldData) return oldData;
                                            return {
                                              ...oldData,
                                              weeks: oldData.weeks.map((week: WeekData) => ({
                                                ...week,
                                                tasks: week.tasks.map((t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-review-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return { ...t, status: checked ? "COMPLETED" : "PENDING" };
                                                  }
                                                  return t;
                                                }),
                                                completedTasks: week.tasks.reduce((count, t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-review-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return count + (checked ? 1 : -1);
                                                  }
                                                  return count + (t.status === "COMPLETED" ? 1 : 0);
                                                }, 0),
                                              })),
                                            };
                                          }
                                        );

                                        // Show toast immediately
                                        toast.success(checked ? "Task completed" : "Task reset");

                                        // Update server in background (non-blocking)
                                        startTransition(async () => {
                                          try {
                                            if (task.entryIds && task.entryIds.length > 0) {
                                              const newStatus = checked ? PlanEntryStatus.COMPLETED : PlanEntryStatus.PENDING;
                                              await Promise.all(
                                                task.entryIds.map((entryId: string) =>
                                                  updatePlanEntryStatusAction(entryId, newStatus)
                                                )
                                              );
                                              // Invalidate cache to refetch updated plan in background
                                              queryClient.invalidateQueries({ queryKey: ["weekly-plan", courseId, refreshKey] });
                                            }
                                          } catch (error) {
                                            // Revert on error using React Query cache
                                            queryClient.setQueryData(
                                              ["weekly-plan", courseId, refreshKey],
                                              (oldData: any) => {
                                                if (!oldData) return oldData;
                                                return {
                                                  ...oldData,
                                                  weeks: oldData.weeks.map((week: WeekData) => ({
                                                    ...week,
                                                    tasks: week.tasks.map((t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-review-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return { ...t, status: previousStatus };
                                                      }
                                                      return t;
                                                    }),
                                                    completedTasks: week.tasks.reduce((count, t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-review-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return count + (previousStatus === "COMPLETED" ? 1 : 0);
                                                      }
                                                      return count + (t.status === "COMPLETED" ? 1 : 0);
                                                    }, 0),
                                                  })),
                                                };
                                              }
                                            );
                                            toast.error("Error updating");
                                          } finally {
                                            setUpdatingTasks(prev => {
                                              const next = new Set(prev);
                                              next.delete(taskKey);
                                              return next;
                                            });
                                          }
                                        });
                                      }}
                                    />
                                    <div className="text-sm font-medium flex-1">
                                      {task.description}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end">
                                    {getStatusBadge(task.status)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Practice Tasks */}
                      {groupedTasks.PRACTICE.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Phase 3 - Pratiquer
                          </h4>
                          <div className="space-y-3 sm:space-y-2 ml-0 sm:ml-6">
                            {groupedTasks.PRACTICE.map((task, index) => (
                              <div
                                key={`practice-${index}`}
                                className="p-3 rounded-lg border border-border/60 bg-muted/30 shadow-sm sm:bg-background sm:shadow-none"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <Checkbox
                                      checked={task.status === "COMPLETED"}
                                      disabled={updatingTasks.has(`practice-${index}`) || (!task.entryIds || task.entryIds.length === 0)}
                                      onCheckedChange={(checked) => {
                                        const taskKey = `practice-${index}`;
                                        setUpdatingTasks(prev => new Set(prev).add(taskKey));
                                        
                                        // Optimistic UI update
                                        const taskIdentifier = `${task.description}-${task.moduleId || ''}-practice-${index}`;
                                        const previousStatus = task.status;
                                        
                                        // Update UI immediately using React Query cache
                                        queryClient.setQueryData(
                                          ["weekly-plan", courseId, refreshKey],
                                          (oldData: any) => {
                                            if (!oldData) return oldData;
                                            return {
                                              ...oldData,
                                              weeks: oldData.weeks.map((week: WeekData) => ({
                                                ...week,
                                                tasks: week.tasks.map((t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-practice-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return { ...t, status: checked ? "COMPLETED" : "PENDING" };
                                                  }
                                                  return t;
                                                }),
                                                completedTasks: week.tasks.reduce((count, t, idx) => {
                                                  const tIdentifier = `${t.description}-${t.moduleId || ''}-practice-${idx}`;
                                                  if (tIdentifier === taskIdentifier) {
                                                    return count + (checked ? 1 : -1);
                                                  }
                                                  return count + (t.status === "COMPLETED" ? 1 : 0);
                                                }, 0),
                                              })),
                                            };
                                          }
                                        );

                                        // Show toast immediately
                                        toast.success(checked ? "Task completed" : "Task reset");

                                        // Update server in background (non-blocking)
                                        startTransition(async () => {
                                          try {
                                            if (task.entryIds && task.entryIds.length > 0) {
                                              const newStatus = checked ? PlanEntryStatus.COMPLETED : PlanEntryStatus.PENDING;
                                              await Promise.all(
                                                task.entryIds.map((entryId: string) =>
                                                  updatePlanEntryStatusAction(entryId, newStatus)
                                                )
                                              );
                                              // Invalidate cache to refetch updated plan in background
                                              queryClient.invalidateQueries({ queryKey: ["weekly-plan", courseId, refreshKey] });
                                            }
                                          } catch (error) {
                                            // Revert on error using React Query cache
                                            queryClient.setQueryData(
                                              ["weekly-plan", courseId, refreshKey],
                                              (oldData: any) => {
                                                if (!oldData) return oldData;
                                                return {
                                                  ...oldData,
                                                  weeks: oldData.weeks.map((week: WeekData) => ({
                                                    ...week,
                                                    tasks: week.tasks.map((t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-practice-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return { ...t, status: previousStatus };
                                                      }
                                                      return t;
                                                    }),
                                                    completedTasks: week.tasks.reduce((count, t, idx) => {
                                                      const tIdentifier = `${t.description}-${t.moduleId || ''}-practice-${idx}`;
                                                      if (tIdentifier === taskIdentifier) {
                                                        return count + (previousStatus === "COMPLETED" ? 1 : 0);
                                                      }
                                                      return count + (t.status === "COMPLETED" ? 1 : 0);
                                                    }, 0),
                                                  })),
                                                };
                                              }
                                            );
                                            toast.error("Error updating");
                                          } finally {
                                            setUpdatingTasks(prev => {
                                              const next = new Set(prev);
                                              next.delete(taskKey);
                                              return next;
                                            });
                                          }
                                        });
                                      }}
                                    />
                                    <div className="text-sm font-medium flex-1">
                                      {task.description}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end">
                                    {getStatusBadge(task.status)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {week.totalTasks === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucune tâche planifiée pour cette semaine
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
