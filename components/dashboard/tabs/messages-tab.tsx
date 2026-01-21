"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMessageThreadsAction } from "@/app/actions/messages";
import { toast } from "sonner";
import { Loader2, MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

type MessageThread = {
  id: string;
  subject: string;
  status: string;
  updatedAt: Date;
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
  }>;
  _count: {
    messages: number;
  };
};

export function MessagesTab() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getMessageThreadsAction({ limit: 100 });
      setThreads(result.items);
    } catch (error) {
      toast.error("Error loading messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="default">Ouvert</Badge>;
      case "CLOSED":
        return <Badge variant="secondary">Fermé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Messages</h2>
          <p className="text-muted-foreground">
            Communiquez avec vos instructeurs
          </p>
        </div>
        <Link href="/dashboard/student/messages/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Poser une question
          </Button>
        </Link>
      </div>

      {threads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun message</h3>
            <p className="text-muted-foreground mb-4">
              Posez une question à vos instructeurs
            </p>
            <Link href="/dashboard/student/messages/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Poser une question
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => {
            const latestMessage = thread.messages[0];
            return (
              <Card key={thread.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{thread.subject}</h3>
                        {getStatusBadge(thread.status)}
                      </div>
                      {latestMessage && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {latestMessage.content}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{thread._count.messages} message{thread._count.messages !== 1 ? "s" : ""}</span>
                        <span>
                          {format(new Date(thread.updatedAt), "d MMM yyyy, HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <Link href={`/dashboard/student/messages/${thread.id}`}>
                      <Button variant="outline" size="sm">
                        Voir
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

