import { requireAdmin } from "@/lib/auth/require-auth";
import { CourseTabs } from "@/components/admin/courses/course-tabs";
import { Suspense } from "react";

interface AdminCoursesPageProps {
  searchParams: Promise<{ tab?: string }>;
}

async function AdminCoursesContent({ searchParams }: AdminCoursesPageProps) {
  await requireAdmin();
  const { tab } = await searchParams;
  const defaultTab = tab === "create" ? "create" : "list";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des cours</h1>
        <p className="text-muted-foreground mt-2">
          Create, edit, and manage your courses
        </p>
      </div>

      <CourseTabs defaultTab={defaultTab} />
    </div>
  );
}

export default function AdminCoursesPage(props: AdminCoursesPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminCoursesContent {...props} />
    </Suspense>
  );
}

