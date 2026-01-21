import { requireAuth } from "@/lib/auth/require-auth";
import { getPaymentHistoryAction } from "@/app/actions/payments";
import { PaymentHistoryList } from "@/components/payment/payment-history-list";

export default async function PaymentHistoryPage() {
  const user = await requireAuth();

  const initialPayments = await getPaymentHistoryAction({
    limit: 20,
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Historique des paiements</h1>
      <PaymentHistoryList initialPayments={initialPayments} />
    </div>
  );
}
