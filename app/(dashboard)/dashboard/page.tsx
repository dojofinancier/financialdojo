import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function DashboardPage() {
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
    redirect("/dashboard/instructeur");
  } else {
    // Unknown role, redirect to login
    console.error(`[DashboardPage] Unknown user role: ${user.role}`);
    redirect("/login");
  }
}
