import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial Dojo - Master Your Finance Exams (CIRE, RSE)",
  description: "Join 2500+ students who passed their Canadian finance exams. Expert-led prep courses for CIRE and RSE. Start your financial career with confidence.",
};

import { HomePageClient } from "@/app/home-page-client";
import { Suspense } from "react";
import { BrutalistNavbar } from "@/components/layout/brutalist-navbar";
import { BrutalistNavbarClient } from "@/components/layout/brutalist-navbar-client";

// ============================================
// MAIN PAGE COMPONENT (Server Component)
// ============================================
export default function HomePage() {
  return (
    <>
      <Suspense
        fallback={<BrutalistNavbarClient user={undefined} variant="transparent" dashboardUrl={null} />}
      >
        <BrutalistNavbar variant="transparent" />
      </Suspense>
      <HomePageClient />
    </>
  );
}
