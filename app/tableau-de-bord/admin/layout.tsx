import { Suspense } from "react";
import { AdminAuthBoundary } from "@/components/admin/admin-auth-boundary";
import { AdminPageLoading } from "@/components/admin/admin-page-loading";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminPageLoading />}>
      <AdminAuthBoundary>{children}</AdminAuthBoundary>
    </Suspense>
  );
}
