import { requireAdmin } from "@/lib/auth/require-auth";
import { Suspense } from "react";
import { AdminDashboardTabs } from "@/components/admin/admin-dashboard-tabs";

interface AdminDashboardPageProps {
  searchParams: Promise<{ tab?: string }>;
}

async function AdminDashboardContent({ searchParams }: AdminDashboardPageProps) {
  const user = await requireAdmin();
  const { tab } = await searchParams;
  const defaultTab = tab || "overview";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome, {user.firstName || user.email}
        </p>
      </div>

      <AdminDashboardTabs defaultTab={defaultTab} />
    </div>
  );
}

export default function AdminDashboardPage(props: AdminDashboardPageProps) {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading dashboard...</div>}>
      <AdminDashboardContent {...props} />
    </Suspense>
  );
}
