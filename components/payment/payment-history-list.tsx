"use client";

import { useState, useEffect } from "react";
import { getPaymentHistoryAction } from "@/app/actions/payments";
import { downloadReceiptAction } from "@/app/actions/payments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type PaymentHistoryListProps = {
  initialPayments: any;
};

export function PaymentHistoryList({ initialPayments }: PaymentHistoryListProps) {
  const [payments, setPayments] = useState(initialPayments.items || []);
  const [cursor, setCursor] = useState(initialPayments.nextCursor);
  const [hasMore, setHasMore] = useState(initialPayments.hasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingReceipts, setDownloadingReceipts] = useState<Set<string>>(new Set());

  const loadMore = async () => {
    if (!cursor || isLoading) return;

    setIsLoading(true);
    try {
      const result = await getPaymentHistoryAction({
        cursor,
        limit: 20,
      });

      setPayments([...payments, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading payments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReceipt = async (paymentIntentId: string) => {
    setDownloadingReceipts((prev) => new Set(prev).add(paymentIntentId));

    try {
      const result = await downloadReceiptAction(paymentIntentId);

      if (result.success && result.data) {
        // Generate PDF receipt (simplified - in production, use a PDF library)
        const receipt = result.data;
        const receiptText = `
REÇU DE PAIEMENT
================

Date: ${format(receipt.date, "d MMMM yyyy", { locale: fr })}
Numéro de transaction: ${receipt.paymentIntentId}

Cours: ${receipt.course.title}
Montant: ${receipt.amount.toFixed(2)} ${receipt.currency}

Client: ${receipt.customer.name}
Courriel: ${receipt.customer.email}

Statut: ${receipt.status === "succeeded" ? "Paid" : receipt.status}
        `.trim();

        // Create blob and download
        const blob = new Blob([receiptText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `receipt-${receipt.paymentIntentId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Receipt downloaded");
      } else {
        toast.error(result.error || "Error during download");
      }
    } catch (error) {
      toast.error("Error downloading the receipt");
    } finally {
      setDownloadingReceipts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(paymentIntentId);
        return newSet;
      });
    }
  };

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucun paiement trouvé</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payments.map((payment: any) => {
        const enrollment = payment.enrollment;
        const paymentIntent = payment.paymentIntent;
        const refunds = payment.refunds || [];
        const hasRefunds = refunds.length > 0;
        const totalRefunded = refunds.reduce(
          (sum: number, refund: any) => sum + refund.amount / 100,
          0
        );
        const netAmount =
          (paymentIntent?.amount || 0) / 100 - totalRefunded;

        return (
          <Card key={enrollment.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{enrollment.course.title}</CardTitle>
                  <CardDescription>
                    {format(enrollment.purchaseDate, "d MMMM yyyy")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {paymentIntent?.status === "succeeded" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-medium">
                  {(paymentIntent?.amount || 0) / 100} CAD
                </span>
              </div>

              {enrollment.couponUsage && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Réduction ({enrollment.couponUsage.coupon.code})
                  </span>
                  <span className="text-green-600">
                    -{Number(enrollment.couponUsage.discountAmount).toFixed(2)} CAD
                  </span>
                </div>
              )}

              {hasRefunds && (
                <div className="space-y-2 border-t pt-2">
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Remboursements</span>
                    <span>-{totalRefunded.toFixed(2)} CAD</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Montant net</span>
                    <span>{netAmount.toFixed(2)} CAD</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  Transaction: {paymentIntent?.id || "N/A"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadReceipt(paymentIntent?.id || "")}
                  disabled={downloadingReceipts.has(paymentIntent?.id || "")}
                >
                  {downloadingReceipts.has(paymentIntent?.id || "") ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Télécharger le reçu
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Chargement...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Charger plus
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

