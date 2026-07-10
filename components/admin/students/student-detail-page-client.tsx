"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStudentDetailsAction } from "@/app/actions/students";
import { StudentDetails } from "@/components/admin/students/student-details";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";

export function StudentDetailPageClient() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const load = useCallback(() => getStudentDetailsAction(studentId), [studentId]);

  return (
    <AdminDetailPageLoader cacheKey={studentId} load={load}>
      {(student) => (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/students">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
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
      )}
    </AdminDetailPageLoader>
  );
}
