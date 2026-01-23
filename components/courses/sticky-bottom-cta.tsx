"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Play } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface StickyBottomCTAProps {
  price: number;
  isEnrolled: boolean;
  inCart: boolean;
  onAddToCart: () => void;
  onGoToCart: () => void;
  onContinue: () => void;
}

export function StickyBottomCTA({
  price,
  isEnrolled,
  inCart,
  onAddToCart,
  onGoToCart,
  onContinue,
}: StickyBottomCTAProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show CTA when scrolled past 80vh (roughly past hero section)
      const scrollPosition = window.scrollY;
      const shouldShow = scrollPosition > window.innerHeight * 0.8;
      setIsVisible(shouldShow);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-black border-t-4 border-white shadow-[0_-8px_0_0_hsl(var(--primary))]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-4xl mx-auto">
            {/* CTA Button - Left side */}
            <div className="flex-shrink-0">
              {isEnrolled ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className="w-full sm:w-auto bg-white text-black font-black uppercase tracking-wider px-8 py-4 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Continuer l'apprentissage →
                  </span>
                </button>
              ) : inCart ? (
                <button
                  type="button"
                  onClick={onGoToCart}
                  className="w-full sm:w-auto bg-white text-black font-black uppercase tracking-wider px-8 py-4 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Voir le panier →
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAddToCart}
                  className="w-full sm:w-auto bg-white text-black font-black uppercase tracking-wider px-8 py-4 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors"
                >
                  Enroll now →
                </button>
              )}
            </div>

            {/* Price info - Right side */}
            {!isEnrolled && (
              <div className="text-left sm:text-right">
                <p className="text-2xl font-black text-white">
                  {formatCurrency(price)}
                </p>
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70">
                  for 12 months of unlimited access
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
