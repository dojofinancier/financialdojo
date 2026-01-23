"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { validateCartCouponAction } from "@/app/actions/cart";
import { toast } from "sonner";

type CartSummaryProps = {
  course: {
    id: string;
    title: string;
    price: number;
  };
  onCouponApplied: (couponCode: string, discountAmount: number, finalAmount: number) => void;
};

export function CartSummary({ course, onCouponApplied }: CartSummaryProps) {
  const [couponCode, setCouponCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const handleApplyCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setIsValidating(true);

    try {
      const result = await validateCartCouponAction(couponCode.trim(), course.id);

      if (result.success && result.data) {
        const discountAmount = Number(result.data.discountAmount);
        const finalAmount = Number(result.data.finalPrice);

        setAppliedCoupon({
          code: couponCode.trim(),
          discountAmount,
          finalAmount,
        });

        onCouponApplied(couponCode.trim(), discountAmount, finalAmount);
        toast.success("Coupon applied successfully!");
      } else {
        toast.error(result.error || "Invalid coupon code");
      }
    } catch (error) {
      toast.error("Error validating coupon");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    onCouponApplied("", 0, course.price);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
        <CardDescription>Review the details before proceeding to payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Course Info */}
        <div className="space-y-2">
          <h3 className="font-semibold">{course.title}</h3>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium">{course.price.toFixed(2)} $</span>
          </div>
        </div>

        {/* Coupon Section */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="coupon">Coupon code</Label>
          {!appliedCoupon ? (
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <Input
                id="coupon"
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={isValidating}
              />
              <Button type="submit" variant="outline" disabled={isValidating}>
                {isValidating ? "..." : "Apply"}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {appliedCoupon.code}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  Discount: -{appliedCoupon.discountAmount.toFixed(2)} $
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveCoupon}
              >
                Remove
              </Button>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="space-y-2 border-t pt-4">
          {appliedCoupon && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{course.price.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{appliedCoupon.discountAmount.toFixed(2)} $</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>
              {appliedCoupon
                ? appliedCoupon.finalAmount.toFixed(2)
                : course.price.toFixed(2)}{" "}
              $
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


