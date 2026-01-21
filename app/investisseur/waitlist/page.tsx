import { Metadata } from "next";
import { WaitlistPageClient } from "./waitlist-page-client";

export const metadata: Metadata = {
  title: "Liste d'attente — Investisseurs | Le Dojo Financier",
  description: "Join the waitlist to be notified about the launch of our investor courses.",
};

export default function InvestisseurWaitlistPage() {
  return <WaitlistPageClient type="investisseur" />;
}
