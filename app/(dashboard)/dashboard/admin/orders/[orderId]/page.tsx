import { requireAdmin } from "@/lib/auth/require-auth";
import { getOrderDetailsAction } from "@/app/actions/orders";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderDetails } from "@/components/admin/orders/order-details";
import { Suspense } from "react";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

async function OrderDetailContent({ params }: OrderDetailPageProps) {
  await requireAdmin();
  const { orderId } = await params;
  const orderData = await getOrderDetailsAction(orderId);

  if (!orderData) {
    notFound();
  }

  return (
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
          ID: {orderData.enrollment.paymentIntentId?.slice(-8) || orderData.enrollment.id.slice(-8)}
        </p>
      </div>
      <OrderDetails orderData={orderData} />
    </div>
  );
}

export default function OrderDetailPage(props: OrderDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Loading order...</div>
        </div>
      }
    >
      <OrderDetailContent {...props} />
    </Suspense>
  );
}

