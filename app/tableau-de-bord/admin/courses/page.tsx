import { requireAdmin } from "@/lib/auth/require-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseList } from "@/components/admin/courses/course-list";
import { CourseForm } from "@/components/admin/courses/course-form";
import { CourseTabs } from "@/components/admin/courses/course-tabs";

interface AdminCoursesPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminCoursesPage({ searchParams }: AdminCoursesPageProps) {
  await requireAdmin();
  const { tab } = await searchParams;
  const defaultTab = tab === "create" ? "create" : "list";

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Course management</h1>
        <p className="text-muted-foreground mt-2">
          Create, edit, and manage your courses
        </p>
      </div>

      <CourseTabs defaultTab={defaultTab} />
    </div>
  );
}

