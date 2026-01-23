"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSupportTickets } from "@/lib/hooks/use-support-tickets";
import { toast } from "sonner";
import { Loader2, Ticket, Plus } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import Link from "next/link";

type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
};

export function SupportTab() {
  const { data, isLoading, error } = useSupportTickets({ limit: 100 });
  const tickets = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="default">Open</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500">In progress</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "CLOSED":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="destructive">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (error) {
    toast.error("Error loading tickets");
  }

  if (isLoading) {
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
          <h2 className="text-2xl font-bold mb-2">Support</h2>
          <p className="text-muted-foreground">
            View and create support tickets
          </p>
        </div>
        <Link href="/dashboard/student/support/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New ticket
          </Button>
        </Link>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No tickets</h3>
            <p className="text-muted-foreground mb-4">
              Create a ticket to get help
            </p>
            <Link href="/dashboard/student/support/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create ticket
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold">{ticket.ticketNumber}</span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <h3 className="font-semibold mb-2">{ticket.subject}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Created on {format(new Date(ticket.createdAt), "d MMM yyyy", { locale: enCA })}
                      </span>
                      <span>
                        Updated on {format(new Date(ticket.updatedAt), "d MMM yyyy", { locale: enCA })}
                      </span>
                    </div>
                  </div>
                  <Link href={`/dashboard/student/support/${ticket.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

