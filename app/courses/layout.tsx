import { Suspense } from "react";
import { BrutalistNavbar } from "@/components/layout/brutalist-navbar";
import { BrutalistNavbarClient } from "@/components/layout/brutalist-navbar-client";

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Suspense
        fallback={
          <BrutalistNavbarClient user={undefined} variant="transparent" dashboardUrl={null} />
        }
      >
        <BrutalistNavbar variant="transparent" />
      </Suspense>

      {children}
    </>
  );
}
