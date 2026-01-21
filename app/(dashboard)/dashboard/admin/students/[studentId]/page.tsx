import { requireAdmin } from "@/lib/auth/require-auth";
import { getStudentDetailsAction } from "@/app/actions/students";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StudentDetails } from "@/components/admin/students/student-details";
import { Suspense } from "react";

interface StudentDetailPageProps {
  params: Promise<{ studentId: string }>;
}

async function StudentDetailContent({ params }: StudentDetailPageProps) {
  await requireAdmin();
  const { studentId } = await params;
  const student = await getStudentDetailsAction(studentId);

  if (!student) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/admin/students">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">
          {student.firstName || student.lastName
            ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
            : "Student"}
        </h1>
        <p className="text-muted-foreground mt-2">{student.email}</p>
      </div>
      <StudentDetails student={student} />
    </div>
  );
}

export default function StudentDetailPage({ params }: StudentDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement de l'étudiant...</div>
        </div>
      }
    >
      <StudentDetailContent params={params} />
    </Suspense>
  );
}

