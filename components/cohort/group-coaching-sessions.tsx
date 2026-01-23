"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, ExternalLink, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { getGroupCoachingSessionsAction } from "@/app/actions/group-coaching-sessions";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/courses/rich-text-editor";

type GroupCoachingSession = {
  id: string;
  cohortId: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  zoomLink: string | null;
  teamsLink: string | null;
  recordingVimeoUrl: string | null;
  adminNotes: string | null;
  status: "UPCOMING" | "COMPLETED" | "CANCELLED";
};

interface GroupCoachingSessionsProps {
  cohortId: string;
}

export function GroupCoachingSessions({ cohortId }: GroupCoachingSessionsProps) {
  const [sessions, setSessions] = useState<GroupCoachingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getGroupCoachingSessionsAction(cohortId);
      if (result.success && result.data) {
        setSessions(result.data as GroupCoachingSession[]);
      }
    } catch (error) {
      toast.error("Error loading sessions");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const upcomingSessions = sessions.filter((s) => s.status === "UPCOMING");
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");

  const isUpcoming = (session: GroupCoachingSession) => {
    return new Date(session.scheduledAt) > new Date() && session.status === "UPCOMING";
  };

  const embedVimeoVideo = (vimeoUrl: string) => {
    // Extract video ID from Vimeo URL
    const match = vimeoUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
    if (match) {
      const videoId = match[1];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return vimeoUrl;
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Group coaching sessions</h2>
        <p className="text-muted-foreground">
          Access live sessions and recordings
        </p>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Upcoming sessions</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingSessions.map((session) => (
              <Card key={session.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{session.title}</CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(session.scheduledAt), "EEEE d MMMM yyyy 'at' HH:mm", {
                            locale: enCA,
                          })}
                        </div>
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Upcoming</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {session.description && (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: session.description }}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {session.zoomLink && (
                      <Button asChild variant="default">
                        <a href={session.zoomLink} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2" />
                          Join Zoom
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                    {session.teamsLink && (
                      <Button asChild variant="default">
                        <a href={session.teamsLink} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2" />
                          Join Teams
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Completed sessions</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {completedSessions.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{session.title}</CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(session.scheduledAt), "EEEE d MMMM yyyy 'at' HH:mm", {
                            locale: enCA,
                          })}
                        </div>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Completed</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {session.description && (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: session.description }}
                    />
                  )}
                  {session.recordingVimeoUrl ? (
                    <div className="space-y-2">
                      <h4 className="font-medium">Recording</h4>
                      <div className="aspect-video w-full">
                        <iframe
                          src={embedVimeoVideo(session.recordingVimeoUrl)}
                          className="w-full h-full rounded-md"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The recording will be available soon
                    </p>
                  )}
                  {session.adminNotes && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <h4 className="font-medium">Instructor notes</h4>
                      </div>
                      <div
                        className="prose prose-sm max-w-none bg-muted p-4 rounded-md"
                        dangerouslySetInnerHTML={{ __html: session.adminNotes }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No sessions scheduled</h3>
            <p className="text-muted-foreground">
              Coaching sessions will appear here once they are scheduled
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

