import { requireAdminOrInstructor } from "@/lib/auth/require-auth";
import { getCohortAction } from "@/app/actions/cohorts";
import { notFound } from "next/navigation";
import { AdminDashboardTabs } from "@/components/admin/admin-dashboard-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CohortForm } from "@/components/admin/cohorts/cohort-form";
import { CohortModuleManagement } from "@/components/admin/cohorts/cohort-module-management";
import { GroupCoachingSessionManagement } from "@/components/admin/cohorts/group-coaching-session-management";
import { CohortMessageBoardModeration } from "@/components/admin/cohorts/cohort-message-board-moderation";
import { CohortEnrollmentManagement } from "@/components/admin/cohorts/cohort-enrollment-management";
import { CohortFAQManagement } from "@/components/admin/cohorts/cohort-faq-management";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

interface CohortDetailPageProps {
  params: Promise<{ cohortId: string }>;
}

async function CohortDetailContent({ params }: CohortDetailPageProps) {
  await requireAdminOrInstructor();
  const { cohortId } = await params;
  const cohortResult = await getCohortAction(cohortId);

  if (!cohortResult.success || !cohortResult.data) {
    notFound();
  }

  const cohort = cohortResult.data;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tableau de bord administrateur</h1>
      </div>
      
      <AdminDashboardTabs defaultTab="cohorts">
        <div className="mt-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/cohorts">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <h2 className="text-2xl font-semibold">{cohort.title}</h2>
            <p className="text-muted-foreground mt-2">
              Manage this cohort's details
            </p>
          </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="faqs">FAQ</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-6">
          <CohortForm
            cohortId={cohortId}
            initialData={{
              title: cohort.title,
              slug: cohort.slug || null,
              description: cohort.description || undefined,
              price: Number(cohort.price),
              maxStudents: cohort.maxStudents,
              enrollmentClosingDate: new Date(cohort.enrollmentClosingDate),
              accessDuration: cohort.accessDuration,
              published: cohort.published,
              instructorId: cohort.instructorId || null,
              componentVisibility: cohort.componentVisibility as any,
            }}
          />
        </TabsContent>
        <TabsContent value="modules" className="mt-6">
          <CohortModuleManagement cohortId={cohortId} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-6">
          <GroupCoachingSessionManagement cohortId={cohortId} />
        </TabsContent>
        <TabsContent value="messages" className="mt-6">
          <CohortMessageBoardModeration cohortId={cohortId} />
        </TabsContent>
        <TabsContent value="enrollments" className="mt-6">
          <CohortEnrollmentManagement cohortId={cohortId} />
        </TabsContent>
        <TabsContent value="faqs" className="mt-6">
          <CohortFAQManagement cohortId={cohortId} />
        </TabsContent>
      </Tabs>
        </div>
      </AdminDashboardTabs>
    </div>
  );
}

export default function CohortDetailPage(props: CohortDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement de la cohorte...</div>
        </div>
      }
    >
      <CohortDetailContent {...props} />
    </Suspense>
  );
}

