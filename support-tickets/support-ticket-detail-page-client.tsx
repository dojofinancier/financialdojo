"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTicketDetailsAction } from "@/app/actions/support-tickets";
import { SupportTicketDetails } from "@/components/admin/support-tickets/support-ticket-details";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";

export function SupportTicketDetailPageClient() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;
  const load = useCallback(() => getTicketDetailsAction(ticketId), [ticketId]);

  return (
    <AdminDetailPageLoader cacheKey={ticketId} load={load}>
      {(ticket) => (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/support-tickets">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Ticket: {ticket.ticketNumber}</h1>
            <p className="text-muted-foreground mt-2">{ticket.subject}</p>
          </div>
          <SupportTicketDetails ticket={ticket} />
        </div>
      )}
    </AdminDetailPageLoader>
  );
}
