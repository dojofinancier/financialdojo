"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllMessageThreadsAction,
} from "@/app/actions/messages";
import { toast } from "sonner";
import { Loader2, Eye, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

type MessageThreadItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
  }>;
  course: {
    id: string;
    title: string;
  } | null;
  _count: {
    messages: number;
  };
};

export function MessageList() {
  const [threads, setThreads] = useState<MessageThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadThreads = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getAllMessageThreadsAction({
        cursor: cursor || undefined,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter as any : undefined,
        search: search || undefined,
      });
      
      if (cursor) {
        setThreads((prev) => [...prev, ...result.items]);
      } else {
        setThreads(result.items);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading messages");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <Input
          placeholder="Search by subject or student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="OPEN">Ouvert</SelectItem>
            <SelectItem value="CLOSED">Fermé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && threads.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun message trouvé
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Cours</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threads.map((thread) => {
                  const latestMessage = thread.messages[0];
                  return (
                    <TableRow key={thread.id}>
                      <TableCell className="font-medium">{thread.subject}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {thread.user.firstName || thread.user.lastName
                              ? `${thread.user.firstName || ""} ${thread.user.lastName || ""}`.trim()
                              : "Sans nom"}
                          </div>
                          <div className="text-sm text-muted-foreground">{thread.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {thread.course ? (
                          <span className="text-sm">{thread.course.title}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Non spécifié</span>
                        )}
                      </TableCell>
                      <TableCell>{thread._count.messages}</TableCell>
                      <TableCell>{getStatusBadge(thread.status)}</TableCell>
                      <TableCell className="text-sm">
                        {latestMessage
                          ? format(new Date(latestMessage.createdAt), "d MMM yyyy, HH:mm", { locale: fr })
                          : format(new Date(thread.updatedAt), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/admin/messages/${thread.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadThreads(nextCursor)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Charger plus"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

