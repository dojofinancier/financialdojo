"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  processRefundAction,
} from "@/app/actions/orders";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DollarSign, User, BookOpen, Calendar, CreditCard, RefreshCw } from "lucide-react";
import Link from "next/link";

type OrderDetailsData = {
  enrollment: {
    id: string;
    purchaseDate: Date;
    expiresAt: Date;
    paymentIntentId: string | null;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
    };
    course: {
      id: string;
      title: string;
      price: number;
      category: {
        name: string;
      };
    };
    couponUsage: {
      coupon: {
        code: string;
      };
      discountAmount: number;
    } | null;
  };
  paymentIntent: any;
  refunds: any[];
};

interface OrderDetailsProps {
  orderData: OrderDetailsData;
}

export function OrderDetails({ orderData }: OrderDetailsProps) {
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [processing, setProcessing] = useState(false);

  const { enrollment, paymentIntent, refunds } = orderData;

  const originalPrice = Number(enrollment.course.price);
  const discount = enrollment.couponUsage
    ? Number(enrollment.couponUsage.discountAmount)
    : 0;
  const finalPrice = Math.max(0, originalPrice - discount);
  const totalRefunded = refunds.reduce(
    (sum, refund) => sum + (refund.amount || 0) / 100,
    0
  );
  const remainingAmount = finalPrice - totalRefunded;

  const getPaymentStatus = () => {
    if (refunds.length > 0 && totalRefunded >= finalPrice) {
      return { label: "Refunded", variant: "destructive" as const };
    }
    if (refunds.length > 0) {
      return { label: "Partially refunded", variant: "secondary" as const };
    }
    switch (paymentIntent?.status) {
      case "succeeded":
        return { label: "Completed", variant: "default" as const };
      case "requires_payment_method":
      case "requires_confirmation":
        return { label: "En attente", variant: "secondary" as const };
      case "canceled":
      case "payment_failed":
        return { label: "Failed", variant: "destructive" as const };
      default:
        return { label: paymentIntent?.status || "Inconnu", variant: "outline" as const };
    }
  };

  const handleRefund = async () => {
    if (refundType === "partial" && (!refundAmount || parseFloat(refundAmount) <= 0)) {
      toast.error("Montant invalide");
      return;
    }

    setProcessing(true);
    try {
      const amount = refundType === "full" ? undefined : parseFloat(refundAmount);
      const result = await processRefundAction(enrollment.id, amount);
      if (result.success) {
        toast.success(
          refundType === "full" ? "Full refund issued" : "Partial refund issued"
        );
        setRefundDialogOpen(false);
        setRefundAmount("");
        window.location.reload();
      } else {
        toast.error(result.error || "Error during refund");
      }
    } catch (error) {
      toast.error("Error during refund");
    } finally {
      setProcessing(false);
    }
  };

  const status = getPaymentStatus();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations étudiant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nom</Label>
              <p className="font-medium">
                {enrollment.user.firstName || enrollment.user.lastName
                  ? `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim()
                  : "Sans nom"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{enrollment.user.email}</p>
            </div>
            {enrollment.user.phone && (
              <div>
                <Label className="text-muted-foreground">Téléphone</Label>
                <p className="font-medium">{enrollment.user.phone}</p>
              </div>
            )}
            <div>
              <Link href={`/dashboard/admin/students/${enrollment.user.id}`}>
                <Button variant="outline" size="sm">
                  Voir le profil étudiant
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Informations cours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Cours</Label>
              <p className="font-medium">{enrollment.course.title}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Catégorie</Label>
              <p className="font-medium">{enrollment.course.category.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date d'achat</Label>
              <p className="font-medium">
                {format(new Date(enrollment.purchaseDate), "d MMMM yyyy, HH:mm", { locale: fr })}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Expiration</Label>
              <p className="font-medium">
                {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div>
              <Link href={`/dashboard/admin/courses/${enrollment.course.id}`}>
                <Button variant="outline" size="sm">
                  Voir le cours
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Détails de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Prix original</Label>
              <p className="text-2xl font-bold">${originalPrice.toFixed(2)}</p>
            </div>
            {enrollment.couponUsage && (
              <div>
                <Label className="text-muted-foreground">Réduction (coupon: {enrollment.couponUsage.coupon.code})</Label>
                <p className="text-2xl font-bold text-destructive">-${discount.toFixed(2)}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Montant payé</Label>
              <p className="text-2xl font-bold text-primary">${finalPrice.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Statut</Label>
              <div className="mt-1">
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
          </div>

          {paymentIntent && (
            <div className="mt-4 space-y-2">
              <div>
                <Label className="text-muted-foreground">ID Paiement Stripe</Label>
                <p className="font-mono text-sm">{paymentIntent.id}</p>
              </div>
              {paymentIntent.payment_method && (
                <div>
                  <Label className="text-muted-foreground">Méthode de paiement</Label>
                  <p className="font-medium">
                    {paymentIntent.payment_method_types?.[0]?.toUpperCase() || "N/A"}
                  </p>
                </div>
              )}
            </div>
          )}

          {refunds.length > 0 && (
            <div className="mt-4">
              <Label className="text-muted-foreground mb-2 block">Historique des remboursements</Label>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>ID Stripe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell>
                          {format(new Date(refund.created * 1000), "d MMM yyyy, HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell>${((refund.amount || 0) / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={refund.status === "succeeded" ? "default" : "secondary"}
                          >
                            {refund.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{refund.id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {remainingAmount > 0 && paymentIntent?.status === "succeeded" && (
            <div className="mt-4">
              <Button
                onClick={() => {
                  setRefundType("full");
                  setRefundDialogOpen(true);
                }}
                variant="destructive"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Rembourser {refunds.length > 0 ? "le reste" : "la commande"}
              </Button>
              {refunds.length === 0 && (
                <Button
                  onClick={() => {
                    setRefundType("partial");
                    setRefundDialogOpen(true);
                  }}
                  variant="outline"
                  className="ml-2"
                >
                  Remboursement partiel
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {refundType === "full" ? "Remboursement complet" : "Remboursement partiel"}
            </DialogTitle>
            <DialogDescription>
              {refundType === "full"
                ? `Rembourser ${remainingAmount.toFixed(2)} $ à l'étudiant`
                : "Enter the amount to refund"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {refundType === "partial" && (
              <div className="space-y-2">
                <Label>Montant ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingAmount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={remainingAmount.toFixed(2)}
                />
                <p className="text-xs text-muted-foreground">
                  Montant restant: ${remainingAmount.toFixed(2)}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleRefund}
                disabled={processing}
              >
                {processing ? "Traitement..." : "Confirmer le remboursement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

