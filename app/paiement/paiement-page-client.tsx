"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe/client";
import { getCourseBySlugOrIdAction } from "@/app/actions/courses";
import { getPublishedCohortBySlugAction } from "@/app/actions/cohorts";
import { PaymentForm } from "@/components/payment/payment-form";
import { toast } from "sonner";
import { Loader2, BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";
import type { CartItem } from "@/lib/utils/cart";
import { Badge } from "@/components/ui/badge";

export function PaiementPageClient() {
  const router = useRouter();
  const stripePromise = useMemo(() => getStripeClient(), []);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(0);

  useEffect(() => {
    async function loadCheckout() {
      try {
        // Check if we have cart data from sessionStorage (coming from cart page)
        const cartData = sessionStorage.getItem("checkout_cart");
        const couponData = sessionStorage.getItem("checkout_coupon");

        if (!cartData) {
          toast.error("No items in the cart");
          router.push("/cart");
          return;
        }

        const items: CartItem[] = JSON.parse(cartData);
        setCartItems(items);

        // Load all courses/cohorts from cart
        const loaded = [];
        for (const item of items) {
          if (item.type === "course") {
            const courseData = await getCourseBySlugOrIdAction(item.slug || item.id);
            if (courseData) {
              // Ensure all Decimal values are converted to numbers
              loaded.push({
                ...courseData,
                 price: typeof courseData.price === 'object' && courseData.price !== null && 'toNumber' in courseData.price 
                   ? (courseData.price as { toNumber: () => number }).toNumber() 
                   : Number(courseData.price),
                 appointmentHourlyRate: courseData.appointmentHourlyRate 
                   ? (typeof courseData.appointmentHourlyRate === 'object' && courseData.appointmentHourlyRate !== null && 'toNumber' in courseData.appointmentHourlyRate
                       ? (courseData.appointmentHourlyRate as { toNumber: () => number }).toNumber()
                       : Number(courseData.appointmentHourlyRate))
                   : null,
                cartItem: item,
              });
            }
          } else if (item.type === "cohort") {
            const cohortData = await getPublishedCohortBySlugAction(item.slug || item.id);
            if (cohortData) {
              // Ensure all Decimal values are converted to numbers
              loaded.push({
                ...cohortData,
                 price: typeof cohortData.price === 'object' && cohortData.price !== null && 'toNumber' in cohortData.price 
                   ? (cohortData.price as { toNumber: () => number }).toNumber() 
                   : Number(cohortData.price),
                cartItem: item,
              });
            }
          }
        }

        if (loaded.length === 0) {
          toast.error("No valid items in the cart");
          router.push("/cart");
          return;
        }

        setProducts(loaded);

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + item.price, 0);

        // Apply coupon if available
        if (couponData) {
          const coupon = JSON.parse(couponData);
          setCouponCode(coupon.code);
          setDiscountAmount(coupon.discountAmount);
          setFinalAmount(coupon.finalAmount);
        } else {
          setFinalAmount(subtotal);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Checkout error:", error);
        toast.error("An error occurred");
        router.push("/cart");
      }
    }

    loadCheckout();
  }, [router]);

  if (isLoading || products.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const total = finalAmount || subtotal;

  // For now, we process payment for the first item
  const primaryItem = products[0];
  const isCohort = primaryItem?.cartItem?.type === "cohort";

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Finaliser votre commande</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Form */}
        <div>
          <Elements
            stripe={stripePromise}
            options={{
              appearance: { theme: "stripe" },
              locale: "fr",
            }}
          >
            <PaymentForm
              courseId={!isCohort ? primaryItem.id : undefined}
              cohortId={isCohort ? primaryItem.id : undefined}
              courseTitle={!isCohort ? primaryItem.title : undefined}
              cohortTitle={isCohort ? primaryItem.title : undefined}
              amount={total}
              originalAmount={subtotal}
              discountAmount={discountAmount}
              couponCode={couponCode || undefined}
              onClientSecretReady={() => {
                // not needed here
              }}
            />
          </Elements>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la commande</CardTitle>
              <CardDescription>Vérifiez les détails avant de procéder au paiement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-start justify-between gap-4 pb-3 border-b last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {item.type === "course" ? (
                          <BookOpen className="h-4 w-4 text-primary" />
                        ) : (
                          <GraduationCap className="h-4 w-4 text-primary" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {item.type === "course" ? "Formation" : "Cohorte"}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{item.title}</p>
                    </div>
                    <span className="font-semibold whitespace-nowrap">{formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Sous-total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Réduction {couponCode && `(${couponCode})`}</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

