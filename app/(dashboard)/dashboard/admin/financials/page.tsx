import { requireAdmin } from "@/lib/auth/require-auth";
import { FinancialsDashboard } from "@/components/admin/financials/financials-dashboard";
import { Suspense } from "react";

async function AdminFinancialsContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Financial management</h1>
        <p className="text-muted-foreground mt-2">
          Revenus, abonnements et rapports financiers
        </p>
      </div>
      <FinancialsDashboard />
    </div>
  );
}

export default function AdminFinancialsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminFinancialsContent />
    </Suspense>
  );
}

