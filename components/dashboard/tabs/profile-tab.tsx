"use client";

import { useState, useEffect } from "react";
import { ProfileForm } from "@/components/profile/profile-form";
import { PaymentHistoryList } from "@/components/payment/payment-history-list";
import { getPaymentHistoryAction } from "@/app/actions/payments";
import { Loader2 } from "lucide-react";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
};

interface ProfileTabProps {
  user: User;
}

export function ProfileTab({ user }: ProfileTabProps) {
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    getPaymentHistoryAction({ limit: 20 })
      .then((result) => {

        if (result && result.items) {
          setPaymentData(result);
        }
      })
      .catch(() => { })
      .finally(() => setLoadingPayments(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">My profile</h2>
        <p className="text-muted-foreground">
          Manage your personal information and account security
        </p>
      </div>
      <ProfileForm
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          signupDate: user.createdAt,
        }}
      />

      {/* Purchase History */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Purchase history</h2>
        <p className="text-muted-foreground mb-4">
          View your transactions and download receipts
        </p>
        {loadingPayments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paymentData ? (
          <PaymentHistoryList initialPayments={paymentData} />
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No purchase history found.
          </p>
        )}
      </div>
    </div>
  );
}
