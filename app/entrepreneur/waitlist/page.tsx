import { Metadata } from "next";
import { WaitlistPageClient } from "@/app/investor/waitlist/waitlist-page-client";

export const metadata: Metadata = {
  title: "Entrepreneur Waitlist | Financial Dojo",
  description: "Join the waitlist to be informed of the launch of our training programs for entrepreneurs.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca"}/entrepreneur/waitlist`,
  },
};

export default function EntrepreneurWaitlistPage() {
  return <WaitlistPageClient type="entrepreneur" />;
}
