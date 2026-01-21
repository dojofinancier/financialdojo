"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/format";
import { getCartItems, removeFromCart, clearCart, type CartItem } from "@/lib/utils/cart";
import { validateCartCouponAction } from "@/app/actions/cart";
import { toast } from "sonner";
import { ShoppingCart, Trash2, ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  useEffect(() => {
    // Load cart items
    const items = getCartItems();
    setCartItems(items);

    // Listen for cart updates
    const handleCartUpdate = () => {
      setCartItems(getCartItems());
    };
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, []);

  const handleRemoveItem = (itemId: string, type: "course" | "cohort") => {
    removeFromCart(itemId, type);
    setCartItems(getCartItems());
    toast.success("Item removed from cart");
  };

  const handleApplyCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    // Apply coupon to first course item (for now, single item checkout)
    const courseItem = cartItems.find((item) => item.type === "course");
    if (!courseItem) {
      toast.error("No courses in the cart");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateCartCouponAction(couponCode.trim(), courseItem.id);

      if (result.success && result.data) {
        const discountAmount = Number(result.data.discountAmount);
        const total = cartItems.reduce((sum, item) => sum + item.price, 0);
        const finalAmount = Number(result.data.finalPrice);

        setAppliedCoupon({
          code: couponCode.trim(),
          discountAmount,
          finalAmount,
        });
        toast.success("Coupon applied successfully!");
      } else {
        toast.error(result.error || "Code de coupon invalide");
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
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Store cart data in sessionStorage for checkout page
    sessionStorage.setItem("checkout_cart", JSON.stringify(cartItems));
    if (appliedCoupon) {
      sessionStorage.setItem("checkout_coupon", JSON.stringify(appliedCoupon));
    }
    
    // Redirect to checkout without slug - checkout will handle all items
    router.push("/payment");
    router.refresh();
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const discount = appliedCoupon?.discountAmount || 0;
  const total = appliedCoupon ? appliedCoupon.finalAmount : subtotal;

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Votre panier est vide</h2>
            <p className="text-muted-foreground mb-4">
              Parcourez nos formations pour ajouter des cours à votre panier
            </p>
            <Link href="/courses">
              <Button>Voir le catalogue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Panier</h1>
        <p className="text-muted-foreground mt-2">
          {cartItems.length} article{cartItems.length !== 1 ? "s" : ""} dans votre panier
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card key={`${item.type}-${item.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {item.type === "course" ? (
                        <BookOpen className="h-5 w-5 text-primary" />
                      ) : (
                        <GraduationCap className="h-5 w-5 text-primary" />
                      )}
                      <Badge variant="outline">
                        {item.type === "course" ? "Formation" : "Cohorte"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <span className="text-xl font-bold whitespace-nowrap">{formatCurrency(item.price)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id, item.type)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}

          {/* Coupon Section */}
          <Card>
            <CardHeader>
              <CardTitle>Code de coupon</CardTitle>
              <CardDescription>Entrez un code promo pour obtenir une réduction</CardDescription>
            </CardHeader>
            <CardContent>
              {!appliedCoupon ? (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <Input
                    placeholder="Entrez le code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={isValidating}
                    className="flex-1"
                  />
                  <Button type="submit" variant="outline" disabled={isValidating}>
                    {isValidating ? "..." : "Appliquer"}
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {appliedCoupon.code}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Réduction: -{formatCurrency(appliedCoupon.discountAmount)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveCoupon}
                  >
                    Retirer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Résumé de la commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Réduction</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button onClick={handleCheckout} className="w-full" size="lg">
                Passer à la caisse
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Link href="/courses" className="w-full">
                <Button variant="outline" className="w-full">
                  Continuer les achats
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

