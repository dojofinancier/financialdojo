"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe/client";
import { getCourseBySlugOrIdAction } from "@/app/actions/courses";
import { PaymentForm } from "@/components/payment/payment-form";
import { CartSummary } from "@/components/payment/cart-summary";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PaiementSlugClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const stripePromise = useMemo(() => getStripeClient(), []);

  const [course, setCourse] = useState<any>(null);
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

        if (cartData) {
          const cartItems = JSON.parse(cartData);
          const firstItem = cartItems[0];

          // Load course by slug or ID
          const courseData = await getCourseBySlugOrIdAction(firstItem.slug || firstItem.id);
          if (!courseData) {
            toast.error("Cours introuvable");
            router.push("/panier");
            return;
          }

          // Ensure all Decimal values are converted to numbers
          setCourse({
            ...courseData,
            price: typeof courseData.price === 'object' && courseData.price !== null && 'toNumber' in courseData.price 
              ? (courseData.price as { toNumber: () => number }).toNumber() 
              : Number(courseData.price),
            appointmentHourlyRate: courseData.appointmentHourlyRate 
              ? (typeof courseData.appointmentHourlyRate === 'object' && courseData.appointmentHourlyRate !== null && 'toNumber' in courseData.appointmentHourlyRate
                  ? (courseData.appointmentHourlyRate as { toNumber: () => number }).toNumber()
                  : Number(courseData.appointmentHourlyRate))
              : null,
          });

          // Apply coupon if available
          if (couponData) {
            const coupon = JSON.parse(couponData);
            setCouponCode(coupon.code);
            setDiscountAmount(coupon.discountAmount);
            setFinalAmount(coupon.finalAmount);
          } else {
            setFinalAmount(Number(courseData.price));
          }
        } else {
          // Direct checkout (no cart) - load course by slug
          const courseData = await getCourseBySlugOrIdAction(slug);
          if (!courseData) {
            toast.error("Cours introuvable");
            router.push("/formations");
            return;
          }

          // Ensure all Decimal values are converted to numbers
          setCourse({
            ...courseData,
            price: typeof courseData.price === 'object' && courseData.price !== null && 'toNumber' in courseData.price 
              ? (courseData.price as { toNumber: () => number }).toNumber() 
              : Number(courseData.price),
            appointmentHourlyRate: courseData.appointmentHourlyRate 
              ? (typeof courseData.appointmentHourlyRate === 'object' && courseData.appointmentHourlyRate !== null && 'toNumber' in courseData.appointmentHourlyRate
                  ? (courseData.appointmentHourlyRate as { toNumber: () => number }).toNumber()
                  : Number(courseData.appointmentHourlyRate))
              : null,
          });
          setFinalAmount(Number(courseData.price));
        }

        // Payment intent will be created when user submits form with email/password
        setIsLoading(false);
      } catch (error) {
        console.error("Checkout error:", error);
        toast.error("Une erreur est survenue");
        router.push("/panier");
      }
    }

    if (slug) {
      loadCheckout();
    }
  }, [slug, router]);

  const handleCouponApplied = async (code: string, discount: number, final: number) => {
    setCouponCode(code);
    setDiscountAmount(discount);
    setFinalAmount(final);
    // Payment intent will be created when form is submitted
  };

  if (isLoading || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Finaliser votre commande</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Form */}
        <div>
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                theme: "stripe",
              },
              locale: "fr",
            }}
          >
            <PaymentForm
              courseId={course.id}
              courseTitle={course.title}
              amount={finalAmount}
              originalAmount={Number(course.price)}
              discountAmount={discountAmount}
              couponCode={couponCode || undefined}
              onClientSecretReady={() => {
                // PaymentForm will create and store it internally; parent doesn't need it.
              }}
            />
          </Elements>
        </div>

        {/* Cart Summary */}
        <div>
          <CartSummary
            course={{
              id: course.id,
              title: course.title,
              price: Number(course.price),
            }}
            onCouponApplied={handleCouponApplied}
          />
        </div>
      </div>
    </div>
  );
}

