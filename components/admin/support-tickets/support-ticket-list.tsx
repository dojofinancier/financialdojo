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
  getSupportTicketsAction,
  getTicketStatisticsAction,
} from "@/app/actions/support-tickets";
import { toast } from "sonner";
import { Loader2, Eye, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TicketItem = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  assignedAdmin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  _count: {
    replies: number;
  };
};

export function SupportTicketList() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedAdminFilter, setAssignedAdminFilter] = useState<string>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadTickets = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getSupportTicketsAction({
        cursor: cursor || undefined,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        assignedAdminId: assignedAdminFilter !== "all" ? assignedAdminFilter : undefined,
        search: search || undefined,
      });
      
      if (cursor) {
        setTickets((prev) => [...prev, ...result.items]);
      } else {
        setTickets(result.items);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, assignedAdminFilter, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadStats = async () => {
    const result = await getTicketStatisticsAction();
    if (result.success) {
      setStats(result.data);
    }
  };

  useEffect(() => {
    if (showStats) {
      loadStats();
    }
  }, [showStats]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="default">Ouvert</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500">En cours</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-500">Résolu</Badge>;
      case "CLOSED":
        return <Badge variant="secondary">Fermé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="destructive">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500">Élevée</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-500">Moyenne</Badge>;
      case "LOW":
        return <Badge variant="secondary">Basse</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <Input
            placeholder="Search by number, subject or description..."
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
              <SelectItem value="IN_PROGRESS">En cours</SelectItem>
              <SelectItem value="RESOLVED">Résolu</SelectItem>
              <SelectItem value="CLOSED">Fermé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les priorités</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">Élevée</SelectItem>
              <SelectItem value="MEDIUM">Moyenne</SelectItem>
              <SelectItem value="LOW">Basse</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowStats(!showStats)} variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          Statistiques
        </Button>
      </div>

      {showStats && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{stats.totalTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ouverts</CardDescription>
              <CardTitle className="text-2xl">{stats.openTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En cours</CardDescription>
              <CardTitle className="text-2xl">{stats.inProgressTickets}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Urgents</CardDescription>
              <CardTitle className="text-2xl text-destructive">{stats.urgentTickets}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun ticket trouvé
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Assigné à</TableHead>
                  <TableHead>Réponses</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                    <TableCell>
                      <div className="max-w-md truncate">{ticket.subject}</div>
                      {ticket.category && (
                        <div className="text-xs text-muted-foreground mt-1">{ticket.category}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {ticket.student.firstName || ticket.student.lastName
                            ? `${ticket.student.firstName || ""} ${ticket.student.lastName || ""}`.trim()
                            : "Sans nom"}
                        </div>
                        <div className="text-sm text-muted-foreground">{ticket.student.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>
                      {ticket.assignedAdmin ? (
                        <div>
                          <div className="font-medium">
                            {ticket.assignedAdmin.firstName || ticket.assignedAdmin.lastName
                              ? `${ticket.assignedAdmin.firstName || ""} ${ticket.assignedAdmin.lastName || ""}`.trim()
                              : ticket.assignedAdmin.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Non assigné</span>
                      )}
                    </TableCell>
                    <TableCell>{ticket._count.replies}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/admin/support-tickets/${ticket.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadTickets(nextCursor)}
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

