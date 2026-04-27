import type { Metadata } from "next";
import { ContactPageClient } from "./contact-page-client";
import { Suspense } from "react";
import { BrutalistNavbar } from "@/components/layout/brutalist-navbar";
import { BrutalistNavbarClient } from "@/components/layout/brutalist-navbar-client";


export const metadata: Metadata = {
  title: "Contact Us",
  description: "Have questions about our CIRE and RSE prep courses? Contact the Financial Dojo team today for personalized support and guidance on your financial career.",
};

export default function ContactPage() {
  return (
    <>
      <Suspense
        fallback={<BrutalistNavbarClient user={undefined} variant="solid" dashboardUrl={null} />}
      >
        <BrutalistNavbar variant="solid" />
      </Suspense>
      <ContactPageClient />
    </>
  );
}

