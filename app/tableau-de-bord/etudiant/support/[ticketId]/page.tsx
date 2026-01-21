import { requireAuth } from "@/lib/auth/require-auth";
import { getTicketDetailsAction } from "@/app/actions/support-tickets";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ViewTicketDetails } from "@/components/dashboard/view-ticket-details";

interface TicketDetailPageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  await requireAuth();
  const { ticketId } = await params;
  const ticket = await getTicketDetailsAction(ticketId);

  if (!ticket) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/student">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Ticket: {ticket.ticketNumber}</h1>
        <p className="text-muted-foreground mt-2">{ticket.subject}</p>
      </div>
      <ViewTicketDetails ticket={ticket} />
    </div>
  );
}

