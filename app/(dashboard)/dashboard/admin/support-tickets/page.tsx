import { requireAdmin } from "@/lib/auth/require-auth";
import { SupportTicketList } from "@/components/admin/support-tickets/support-ticket-list";
import { Suspense } from "react";

async function AdminSupportTicketsContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des tickets de support</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage all student support tickets
        </p>
      </div>
      <SupportTicketList />
    </div>
  );
}

export default function AdminSupportTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminSupportTicketsContent />
    </Suspense>
  );
}

