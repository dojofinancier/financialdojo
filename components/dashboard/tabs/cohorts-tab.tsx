"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap,
  Users,
  Clock,
  ArrowRight,
  Video,
  MessageSquare,
  Calendar,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { getCohortsSummaryAction } from "@/app/actions/cohort-summary";
import { toast } from "sonner";

type CohortEnrollment = {
  id: string;
  cohortId: string;
  purchaseDate: Date;
  expiresAt: Date;
  cohort: {
    id: string;
    title: string;
    slug: string | null;
    instructor: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
};

type CohortSummary = {
  cohortId: string;
  nextSession: {
    id: string;
    title: string;
    scheduledAt: Date;
    zoomLink: string | null;
    teamsLink: string | null;
  } | null;
  unreadMessageCount: number;
  totalSessions: number;
  completedSessions: number;
};

interface CohortsTabProps {
  cohortEnrollments: CohortEnrollment[];
}

export function CohortsTab({ cohortEnrollments }: CohortsTabProps) {
  const [summaries, setSummaries] = useState<Record<string, CohortSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);

  const activeEnrollments = cohortEnrollments.filter((e) => !isPast(new Date(e.expiresAt)));
  const expiredEnrollments = cohortEnrollments.filter((e) => isPast(new Date(e.expiresAt)));

  useEffect(() => {
    async function loadSummaries() {
      if (activeEnrollments.length === 0) {
        setLoadingSummaries(false);
        return;
      }

      try {
        const cohortIds = activeEnrollments.map((e) => e.cohortId);
        const result = await getCohortsSummaryAction(cohortIds);
        if (result.success && result.data) {
          setSummaries(result.data);
        }
      } catch (error) {
        console.error("Error loading cohort summaries:", error);
      } finally {
        setLoadingSummaries(false);
      }
    }

    loadSummaries();
  }, [activeEnrollments.length]);

  const getSessionTimeDisplay = (scheduledAt: Date) => {
    if (isToday(scheduledAt)) {
      return `Aujourd'hui à ${format(scheduledAt, "HH:mm", { locale: fr })}`;
    }
    if (isTomorrow(scheduledAt)) {
      return `Demain à ${format(scheduledAt, "HH:mm", { locale: fr })}`;
    }
    return format(scheduledAt, "d MMMM yyyy at HH:mm", { locale: fr });
  };

  const getSessionUrgency = (scheduledAt: Date) => {
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 1) return "now"; // Starting within 1 hour
    if (hoursUntil < 24) return "soon"; // Starting within 24 hours
    return "upcoming";
  };

  const handleJoinSession = (session: CohortSummary["nextSession"]) => {
    if (!session) return;

    const link = session.zoomLink || session.teamsLink;
    if (link) {
      window.open(link, "_blank");
    } else {
      toast.error("Aucun lien de session disponible");
    }
  };

  if (activeEnrollments.length === 0 && expiredEnrollments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Aucune cohorte inscrite</h3>
          <p className="text-muted-foreground mb-4">
            Découvrez nos cohortes pour un apprentissage en groupe
          </p>
          <Link href="/cohorts">
            <Button>Voir les cohortes</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {activeEnrollments.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Mes cohortes actives</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeEnrollments.map((enrollment) => {
              const summary = summaries[enrollment.cohortId];
              const nextSession = summary?.nextSession;
              const unreadCount = summary?.unreadMessageCount || 0;
              const sessionUrgency = nextSession ? getSessionUrgency(nextSession.scheduledAt) : null;

              return (
                <Card
                  key={enrollment.id}
                  className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 relative"
                >
                  {/* Status Badges */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                    {nextSession && sessionUrgency === "now" && (
                      <Badge className="bg-red-500 hover:bg-red-600 animate-pulse">
                        <Video className="h-3 w-3 mr-1" />
                        En cours
                      </Badge>
                    )}
                    {nextSession && sessionUrgency === "soon" && (
                      <Badge className="bg-orange-500 hover:bg-orange-600">
                        <Video className="h-3 w-3 mr-1" />
                        Bientôt
                      </Badge>
                    )}
                    {unreadCount > 0 && (
                      <Badge className="bg-blue-500 hover:bg-blue-600">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {unreadCount} nouveau{unreadCount > 1 ? "x" : ""}
                      </Badge>
                    )}
                  </div>

                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        Cohorte
                      </Badge>
                    </div>
                    <CardTitle className="text-lg pr-20">{enrollment.cohort.title}</CardTitle>
                    <CardDescription>
                      Inscrit le {format(new Date(enrollment.purchaseDate), "d MMMM yyyy", { locale: fr })}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Instructor Info */}
                    {enrollment.cohort.instructor && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {enrollment.cohort.instructor.firstName || enrollment.cohort.instructor.lastName
                            ? `${enrollment.cohort.instructor.firstName || ""} ${enrollment.cohort.instructor.lastName || ""}`.trim()
                            : enrollment.cohort.instructor.email}
                        </span>
                      </div>
                    )}

                    {/* Next Session */}
                    {nextSession && (
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Video className="h-4 w-4 text-primary" />
                          <span>Prochaine session</span>
                        </div>
                        <p className="text-sm font-semibold">{nextSession.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{getSessionTimeDisplay(nextSession.scheduledAt)}</span>
                        </div>
                        {sessionUrgency && (sessionUrgency === "now" || sessionUrgency === "soon") && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleJoinSession(nextSession)}
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            Rejoindre la session
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Unread Messages */}
                    {unreadCount > 0 && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">
                              {unreadCount} message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Session Progress */}
                    {summary && summary.totalSessions > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Sessions</span>
                          <span className="font-medium">
                            {summary.completedSessions} / {summary.totalSessions}
                          </span>
                        </div>
                        <Progress
                          value={(summary.completedSessions / summary.totalSessions) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Expiration Info */}
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Expire le</span>
                      <span className="font-medium">
                        {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                      {nextSession && (sessionUrgency === "now" || sessionUrgency === "soon") && (
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => handleJoinSession(nextSession)}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Rejoindre la session
                        </Button>
                      )}
                      {unreadCount > 0 && (
                        <Link
                          href={`/cohorts/${enrollment.cohort.slug || enrollment.cohort.id}/learn?tab=messages`}
                          prefetch={false}
                          className="block"
                        >
                          <Button variant="outline" className="w-full">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Voir les messages ({unreadCount})
                          </Button>
                        </Link>
                      )}
                      <Link 
                        href={`/cohorts/${enrollment.cohort.slug || enrollment.cohort.id}/learn`}
                        prefetch={false}
                        className="block"
                      >
                        <Button 
                          variant={unreadCount > 0 || (nextSession && sessionUrgency === "now") ? "outline" : "default"} 
                          className="w-full"
                        >
                          Accéder à la cohorte
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {expiredEnrollments.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Cohortes expirées</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {expiredEnrollments.map((enrollment) => (
              <Card key={enrollment.id} className="opacity-60 border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Cohorte
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{enrollment.cohort.title}</CardTitle>
                  <CardDescription>
                    Expiré le {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/cohorts/${enrollment.cohort.slug || enrollment.cohort.id}`}>
                    <Button variant="outline" className="w-full">
                      Voir les détails
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

