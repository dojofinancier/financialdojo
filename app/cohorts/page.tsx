import { redirect } from "next/navigation";

/**
 * Redirect /cohorts to /courses#cohortes for backward compatibility
 */
export default function CohortsPage() {
  redirect("/courses#cohortes");
}
