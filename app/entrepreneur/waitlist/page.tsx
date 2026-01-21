import { Metadata } from "next";
import { WaitlistPageClient } from "@/app/investor/waitlist/waitlist-page-client";

export const metadata: Metadata = {
  title: "Liste d'attente — Entrepreneurs | Le Dojo Financier",
  description: "Join the waiting list to be informed of the launch of our training programs for entrepreneurs.",
};

export default function EntrepreneurWaitlistPage() {
  return <WaitlistPageClient type="entrepreneur" />;
}
