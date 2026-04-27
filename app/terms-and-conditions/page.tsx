import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Financial Dojo",
  description: "Terms of Use of the Financial Dojo",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/terms-and-conditions`,
  },
};

export { default } from "@/app/termes-et-conditions/page";
