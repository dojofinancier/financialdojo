import { requireAdmin } from "@/lib/auth/require-auth";
import { getTicketDetailsAction } from "@/app/actions/support-tickets";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportTicketDetails } from "@/components/admin/support-tickets/support-ticket-details";
import { Suspense } from "react";

interface TicketDetailPageProps {
  params: Promise<{ ticketId: string }>;
}

async function TicketDetailContent({ params }: TicketDetailPageProps) {
  await requireAdmin();
  const { ticketId } = await params;
  const ticket = await getTicketDetailsAction(ticketId);

  if (!ticket) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/admin/support-tickets">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Ticket: {ticket.ticketNumber}</h1>
        <p className="text-muted-foreground mt-2">{ticket.subject}</p>
      </div>
      <SupportTicketDetails ticket={ticket} />
    </div>
  );
}

export default function TicketDetailPage({ params }: TicketDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement du ticket...</div>
        </div>
      }
    >
      <TicketDetailContent params={params} />
    </Suspense>
  );
}

