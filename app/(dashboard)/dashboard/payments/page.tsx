import { Suspense } from "react";
import { requireAuth } from "@/lib/auth/require-auth";
import { getPaymentHistoryAction } from "@/app/actions/payments";
import { PaymentHistoryList } from "@/components/payment/payment-history-list";

async function PaymentHistoryContent() {
  await requireAuth();

  const initialPayments = await getPaymentHistoryAction({
    limit: 20,
  });

  return <PaymentHistoryList initialPayments={initialPayments} />;
}

export default function PaymentHistoryPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Payment history</h1>
      <Suspense
        fallback={<div className="text-muted-foreground">Loading payment history...</div>}
      >
        <PaymentHistoryContent />
      </Suspense>
    </div>
  );
}
