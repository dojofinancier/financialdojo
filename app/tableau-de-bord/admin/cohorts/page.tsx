import { requireAdminOrInstructor } from "@/lib/auth/require-auth";
import { AdminDashboardTabs } from "@/components/admin/admin-dashboard-tabs";
import { CohortTabs } from "@/components/admin/cohorts/cohort-tabs";

interface AdminCohortsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminCohortsPage({ searchParams }: AdminCohortsPageProps) {
  await requireAdminOrInstructor();
  const { tab } = await searchParams;
  const defaultTab = tab === "create" ? "create" : "list";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
      </div>
      
      <AdminDashboardTabs defaultTab="cohorts">
        <div className="mt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Cohort management</h2>
            <p className="text-muted-foreground mt-2">
              Create, edit, and manage your group coaching cohorts
            </p>
          </div>
          <CohortTabs defaultTab={defaultTab} />
        </div>
      </AdminDashboardTabs>
    </div>
  );
}

