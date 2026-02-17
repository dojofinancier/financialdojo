"use client";

import { useState } from "react";
import { getPaymentHistoryAction } from "@/app/actions/payments";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { enCA } from "date-fns/locale";

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
      const res = await fetch(`/api/receipt/${paymentIntentId}`, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as { error?: string }).error ?? "Error downloading the receipt"
        );
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const match = contentDisposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `receipt-${paymentIntentId}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Receipt downloaded");
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
          <p className="text-muted-foreground">No payments found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Product</TableHead>
              <TableHead>Purchase date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Expiration date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment: any) => {
              const enrollment = payment.enrollment;
              const paymentIntent = payment.paymentIntent;
              const refunds = payment.refunds || [];
              const totalRefunded = refunds.reduce(
                (sum: number, refund: any) => sum + refund.amount / 100,
                0
              );
              const netAmount = (paymentIntent?.amount || 0) / 100 - totalRefunded;
              const isExpired = isPast(new Date(enrollment.expiresAt));

              return (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {enrollment.course.title}
                      <Badge variant="outline" className="text-xs font-normal">Course</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(enrollment.purchaseDate), "d MMM yyyy", { locale: enCA })}
                  </TableCell>
                  <TableCell>
                    ${netAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(enrollment.expiresAt), "d MMM yyyy", { locale: enCA })}
                  </TableCell>
                  <TableCell>
                    {isExpired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReceipt(enrollment.paymentIntentId || "")}
                      disabled={!enrollment.paymentIntentId || downloadingReceipts.has(enrollment.paymentIntentId)}
                    >
                      {downloadingReceipts.has(enrollment.paymentIntentId || "") ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download receipt (PDF)
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load more
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}


