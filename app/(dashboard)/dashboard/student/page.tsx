import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { requireAuth } from "@/lib/auth/require-auth";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";

// Separate component for data fetching to enable streaming
async function StudentDashboardContent() {
  const user = await requireAuth();

  // IMPORTANT:
  // The student dashboard only needs *summary* data (active courses/cohorts).
  // Do NOT query course modules/quizzes/flashcards here — that belongs to /learn/*.
  //
  // Also avoid calling server actions that each call requireAuth() again; we already have `user`.
  const [enrollments, cohortEnrollments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: user.id },
      orderBy: { purchaseDate: "desc" },
      select: {
        id: true,
        courseId: true,
        purchaseDate: true,
        expiresAt: true,
        course: {
          select: {
            id: true,
            title: true,
            code: true,
            slug: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.cohortEnrollment.findMany({
      where: { userId: user.id },
      orderBy: { purchaseDate: "desc" },
      select: {
        id: true,
        cohortId: true,
        purchaseDate: true,
        expiresAt: true,
        cohort: {
          select: {
            id: true,
            title: true,
            slug: true,
            instructor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <StudentDashboard
      user={user}
      initialEnrollments={enrollments}
      initialCohortEnrollments={cohortEnrollments}
    />
  );
}

export default async function StudentDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <StudentDashboardContent />
    </Suspense>
  );
}
