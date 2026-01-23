import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function DashboardRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    console.log("[DashboardPage] No user found, redirecting to /login");
    redirect("/login");
  }

  // Redirect based on role
  console.log(`[DashboardPage] User role: ${user.role}, redirecting to appropriate dashboard`);
  if (user.role === "ADMIN") {
    redirect("/dashboard/admin");
  } else if (user.role === "STUDENT") {
    redirect("/dashboard/student");
  } else if (user.role === "INSTRUCTOR") {
    redirect("/dashboard/admin");
  } else {
    // Unknown role, redirect to login
    console.error(`[DashboardPage] Unknown user role: ${user.role}`);
    redirect("/login");
  }

  return null;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading dashboard...</div>}>
      <DashboardRedirect />
    </Suspense>
  );
}
