import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Assessment | Financial Dojo",
  description: "A short, structured assessment to clarify how you make investment decisions.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/investor`,
  },
};

export { default } from "@/app/investisseur/page";
