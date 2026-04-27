import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Financial Dojo",
  description: "Discover the history and mission of the Financial Dojo",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/about`,
  },
};

export { default } from "@/app/a-propos/page";
