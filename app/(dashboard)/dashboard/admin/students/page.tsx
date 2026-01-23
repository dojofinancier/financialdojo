import { requireAdmin } from "@/lib/auth/require-auth";
import { StudentList } from "@/components/admin/students/student-list";
import { Suspense } from "react";

async function AdminStudentsContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Student management</h1>
        <p className="text-muted-foreground mt-2">
          Manage student accounts, enrollments, and progress
        </p>
      </div>
      <StudentList />
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminStudentsContent />
    </Suspense>
  );
}

