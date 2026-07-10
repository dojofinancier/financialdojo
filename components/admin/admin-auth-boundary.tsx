import { requireAdminOrInstructor } from "@/lib/auth/require-auth";

/**
 * Server-side auth gate for all /tableau-de-bord/admin routes.
 * Instructors can access cohort management; individual server actions
 * enforce admin-only where needed.
 */
export async function AdminAuthBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOrInstructor();
  return children;
}
