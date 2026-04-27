import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Financial Dojo",
  description: "Financial Dojo Privacy Policy",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/privacy-policy`,
  },
};

export { default } from "@/app/politique-de-confidentialite/page";
