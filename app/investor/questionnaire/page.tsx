import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Diagnostic Questionnaire | Financial Dojo",
  description: "Answer 6 questions to clarify your investment decision style.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/investor/questionnaire`,
  },
};

export { default } from "@/app/investisseur/questionnaire/page";
