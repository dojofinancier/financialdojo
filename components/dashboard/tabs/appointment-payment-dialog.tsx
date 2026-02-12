"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { StripeCardElementChangeEvent } from "@stripe/stripe-js";
import { confirmAppointmentPaymentAction } from "@/app/actions/appointment-payment";
import { toast } from "sonner";
import { getStripeClient } from "@/lib/stripe/client";
import { Loader2 } from "lucide-react";

interface AppointmentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  appointmentId: string;
  amount?: number;
}

function PaymentForm({
  clientSecret,
  appointmentId,
  amount,
  onSuccess,
}: {
  clientSecret: string;
  appointmentId: string;
  amount?: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // Check if Stripe is loaded
  useEffect(() => {
    if (!stripe) {
      // Wait a bit for Stripe to load
      const timer = setTimeout(() => {
        if (!stripe) {
          setStripeError("Stripe could not load. Please refresh the page.");
        }
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setStripeError(null);
    }
  }, [stripe]);

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "14px",
        color: "hsl(var(--foreground))",
        fontFamily: "inherit",
        fontWeight: "400",
        letterSpacing: "0",
        "::placeholder": {
          color: "hsl(var(--muted-foreground))",
          opacity: 1,
        },
      },
      invalid: {
        color: "hsl(var(--destructive))",
        iconColor: "hsl(var(--destructive))",
      },
    },
    hidePostalCode: true,
    disableLink: true,
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error("Stripe is not yet loaded");
      return;
    }

    if (!cardholderName.trim()) {
      toast.error("Please enter the cardholder's name");
      return;
    }

    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        toast.error("Error loading the payment form");
        setIsProcessing(false);
        return;
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardholderName.trim(),
            },
          },
        }
      );

      if (error) {
        let errorMessage = "Payment error";
        if (error.type === "card_error") {
          switch (error.code) {
            case "card_declined":
              errorMessage = "Your card was declined.";
              break;
            case "insufficient_funds":
              errorMessage = "Fonds insuffisants.";
              break;
            case "expired_card":
              errorMessage = "Your card has expired.";
              break;
            case "incorrect_cvc":
              errorMessage = "Incorrect security code.";
              break;
            default:
              errorMessage = error.message || "Payment error.";
          }
        } else {
          errorMessage = error.message || "An error occurred.";
        }
        toast.error(errorMessage);
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        const result = await confirmAppointmentPaymentAction(appointmentId, paymentIntent.id);
        if (result.success) {
          toast.success("Appointment confirmed!");
          setIsProcessing(false);
          setTimeout(() => onSuccess(), 1000);
        } else {
          toast.error(result.error || "Error confirming");
          setIsProcessing(false);
        }
      } else {
        toast.error("Payment was not completed");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  if (!stripe) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading Stripe...</p>
          </div>
        </div>
        {stripeError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{stripeError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 relative">
      {/* Cardholder Name */}
      <div className="space-y-2">
        <Label htmlFor="cardholderName">Cardholder name</Label>
        <Input
          id="cardholderName"
          type="text"
          placeholder="Jean Dupont"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {/* Card Element - matching checkout styling */}
      <div className="space-y-2 relative z-0">
        <Label>Card number</Label>
        <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden [&_.StripeElement]:h-full [&_.StripeElement_iframe]:h-full [&_.StripeElement_iframe]:min-h-0 [&_.StripeElement]:max-h-[40px] [&_.StripeElement_iframe]:max-h-[40px]">
          <div className="flex-1 h-full max-h-[40px] overflow-hidden">
            <CardElement
              options={cardElementOptions}
              onChange={handleCardChange}
            />
          </div>
        </div>
        {cardError && (
          <p className="text-sm text-destructive">{cardError}</p>
        )}
      </div>

      {/* Amount Display */}
      {amount && (
        <div className="flex justify-between text-lg font-bold border-t pt-4">
          <span>Total</span>
          <span>{amount.toFixed(2)} $</span>
        </div>
      )}

      <Button type="submit" className="w-full relative z-20" disabled={isProcessing || !stripe}>
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : amount ? (
          `Pay ${amount.toFixed(2)} $`
        ) : (
          "Pay and confirm"
        )}
      </Button>
    </form>
  );
}

export function AppointmentPaymentDialog({
  open,
  onOpenChange,
  clientSecret,
  appointmentId,
  amount,
}: AppointmentPaymentDialogProps) {
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      toast.error("Stripe configuration missing");
    }
    return getStripeClient();
  }, []);
  
  const handleSuccess = () => {
    onOpenChange(false);
    window.location.href = "/dashboard/student?tab=appointments";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Appointment payment</DialogTitle>
          <DialogDescription>
            Complete payment to confirm your appointment
          </DialogDescription>
        </DialogHeader>

        {stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              appearance: { theme: "stripe" },
              locale: "en",
            }}
          >
            <PaymentForm
              clientSecret={clientSecret}
              appointmentId={appointmentId}
              amount={amount}
              onSuccess={handleSuccess}
            />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Initializing payment...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
