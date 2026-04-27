import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Waitlist | Financial Dojo",
  description: "Join the waitlist to be notified about the launch of our investor courses.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/investor/waitlist`,
  },
};

export { default } from "@/app/investisseur/waitlist/page";
