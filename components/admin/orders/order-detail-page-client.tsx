"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderDetailsAction } from "@/app/actions/orders";
import { OrderDetails } from "@/components/admin/orders/order-details";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";

export function OrderDetailPageClient() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const load = useCallback(() => getOrderDetailsAction(orderId), [orderId]);

  return (
    <AdminDetailPageLoader cacheKey={orderId} load={load}>
      {(orderData) => (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/orders">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Order details</h1>
            <p className="text-muted-foreground mt-2">
              ID:{" "}
              {orderData.enrollment.paymentIntentId?.slice(-8) ||
                orderData.enrollment.id.slice(-8)}
            </p>
          </div>
          <OrderDetails orderData={orderData} />
        </div>
      )}
    </AdminDetailPageLoader>
  );
}
