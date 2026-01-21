import { redirect } from "next/navigation";

/**
 * Redirect /checkout to /payment for backward compatibility
 */
export default function CheckoutPage() {
  redirect("/payment");
}
