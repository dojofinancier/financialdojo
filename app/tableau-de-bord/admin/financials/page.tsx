import { requireAdmin } from "@/lib/auth/require-auth";
import { FinancialsDashboard } from "@/components/admin/financials/financials-dashboard";

export default async function AdminFinancialsPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Financial management</h1>
        <p className="text-muted-foreground mt-2">
          Revenue, subscriptions, and financial reports
        </p>
      </div>
      <FinancialsDashboard />
    </div>
  );
}

