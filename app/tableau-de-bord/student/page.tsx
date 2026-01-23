import { requireStudent } from "@/lib/auth/require-auth";
import { getUserEnrollmentsAction } from "@/app/actions/enrollments";
import { getUserCohortEnrollmentsAction } from "@/app/actions/cohort-enrollments";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";

export default async function StudentDashboardPage() {
  let user;
  try {
    user = await requireStudent();
    console.log(`[StudentDashboardPage] User authenticated: ${user.email}, role: ${user.role}`);
  } catch (error) {
    const redirectDigest = (error as { digest?: string } | null)?.digest;
    if (!redirectDigest?.startsWith("NEXT_REDIRECT")) {
      console.error("[StudentDashboardPage] Error in requireStudent:", error);
    }
    throw error; // Re-throw to let Next.js handle the redirect
  }

  // Fetch data in parallel
  const [enrollments, cohortEnrollments] = await Promise.all([
    getUserEnrollmentsAction({ limit: 100 }),
    getUserCohortEnrollmentsAction({ limit: 100 }),
  ]);

  // Serialize user object (remove any non-serializable fields like supabaseUser)
  // Dates are fine to pass, but we need to exclude supabaseUser if it exists
  const serializedUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return (
    <StudentDashboard
      user={serializedUser}
      initialEnrollments={enrollments.items}
      initialCohortEnrollments={cohortEnrollments.items}
    />
  );
}
