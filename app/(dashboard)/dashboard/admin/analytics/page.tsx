import { requireAdmin } from "@/lib/auth/require-auth";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";
import { Suspense } from "react";

async function AdminAnalyticsContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tableau de bord analytique</h1>
        <p className="text-muted-foreground mt-2">
          Enrollment metrics, completion rates, and engagement
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminAnalyticsContent />
    </Suspense>
  );
}

