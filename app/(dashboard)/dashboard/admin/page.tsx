import { requireAdmin } from "@/lib/auth/require-auth";
import { AdminDashboardTabs } from "@/components/admin/admin-dashboard-tabs";

interface AdminDashboardPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const user = await requireAdmin();
  const { tab } = await searchParams;
  const defaultTab = tab || "overview";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tableau de bord administrateur</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenue, {user.firstName || user.email}
        </p>
      </div>

      <AdminDashboardTabs defaultTab={defaultTab} />
    </div>
  );
}
