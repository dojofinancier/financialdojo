import { redirect } from "next/navigation";

/**
 * Redirect /cohorts to /courses#cohortes for backward compatibility
 */
export default function CohortePage() {
  redirect("/courses#cohortes");
}
