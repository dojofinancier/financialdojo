import { requireAdmin } from "@/lib/auth/require-auth";
import { CouponTabs } from "@/components/admin/coupons/coupon-tabs";
import { Suspense } from "react";

async function AdminCouponsContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des coupons</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage promo codes
        </p>
      </div>
      <CouponTabs />
    </div>
  );
}

export default function AdminCouponsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminCouponsContent />
    </Suspense>
  );
}

