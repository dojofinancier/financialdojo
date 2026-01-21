"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCouponsAction,
  deleteCouponAction,
  updateCouponAction,
  getCouponUsageStatsAction,
} from "@/app/actions/coupons";
import { toast } from "sonner";
import { Loader2, Edit, Trash2, Eye, Copy, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Coupon } from "@prisma/client";

interface CouponListProps {
  onEdit?: (couponId: string) => void;
}

export function CouponList({ onEdit }: CouponListProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);

  const loadCoupons = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getCouponsAction({
        cursor: cursor || undefined,
        limit: 20,
        active: activeFilter,
      });
      if (cursor) {
        setCoupons((prev) => [...prev, ...result.items]);
      } else {
        setCoupons(result.items);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading coupons");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleDelete = async () => {
    if (!selectedCoupon) return;

    const result = await deleteCouponAction(selectedCoupon.id);
    if (result.success) {
      toast.success("Coupon deleted");
      setDeleteDialogOpen(false);
      setSelectedCoupon(null);
      loadCoupons();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    const result = await updateCouponAction(coupon.id, {
      active: !coupon.active,
    });
    if (result.success) {
      toast.success(`Coupon ${!coupon.active ? "enabled" : "disabled"}`);
      loadCoupons();
    } else {
      toast.error(result.error || "Error updating");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  const filteredCoupons = coupons.filter((coupon) =>
    coupon.code.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    if (!coupon.active) {
      return <Badge variant="secondary">Inactif</Badge>;
    }
    if (now < coupon.validFrom) {
      return <Badge variant="outline">À venir</Badge>;
    }
    if (now > coupon.validUntil) {
      return <Badge variant="destructive">Expiré</Badge>;
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return <Badge variant="destructive">Limite atteinte</Badge>;
    }
    return <Badge className="bg-primary">Actif</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Rechercher un coupon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={activeFilter === undefined ? "all" : activeFilter ? "active" : "inactive"}
          onValueChange={(value) => {
            setActiveFilter(
              value === "all" ? undefined : value === "active"
            );
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && coupons.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun coupon trouvé
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Utilisations</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        {coupon.code}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(coupon.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {coupon.discountType === "PERCENTAGE" ? "Pourcentage" : "Montant fixe"}
                    </TableCell>
                    <TableCell>
                      {coupon.discountType === "PERCENTAGE"
                        ? `${coupon.discountValue}%`
                        : `$${Number(coupon.discountValue).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {coupon.usedCount} / {coupon.usageLimit || "∞"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(coupon.validFrom), "d MMM yyyy", { locale: fr })} -{" "}
                      {format(new Date(coupon.validUntil), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>{getStatusBadge(coupon)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setStatsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(coupon)}
                        >
                          {coupon.active ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadCoupons(nextCursor)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Charger plus"
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le coupon</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le coupon "{selectedCoupon?.code}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCoupon && (
        <CouponStatsDialog
          couponId={selectedCoupon.id}
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
        />
      )}
    </div>
  );
}

interface CouponStatsDialogProps {
  couponId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CouponStatsDialog({ couponId, open, onOpenChange }: CouponStatsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (open && couponId) {
      const loadStats = async () => {
        setLoading(true);
        const result = await getCouponUsageStatsAction(couponId);
        if (result.success) {
          setStats(result.data);
        } else {
          toast.error(result.error || "Error loading statistics");
        }
        setLoading(false);
      };
      loadStats();
    }
  }, [open, couponId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statistiques d'utilisation</DialogTitle>
          <DialogDescription>
            Détails d'utilisation du coupon
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : stats ? (
          <div className="mt-4 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Utilisations totales</p>
                <p className="text-2xl font-bold">{stats.totalUsage}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Réduction totale</p>
                <p className="text-2xl font-bold">${stats.totalDiscount.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Réduction moyenne</p>
                <p className="text-2xl font-bold">${stats.averageDiscount.toFixed(2)}</p>
              </div>
            </div>

            {stats.coupon.couponUsage.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Historique d'utilisation</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Étudiant</TableHead>
                        <TableHead>Cours</TableHead>
                        <TableHead>Réduction</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.coupon.couponUsage.map((usage: any) => (
                        <TableRow key={usage.id}>
                          <TableCell>
                            {usage.enrollment.user.firstName} {usage.enrollment.user.lastName}
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {usage.enrollment.user.email}
                            </span>
                          </TableCell>
                          <TableCell>{usage.enrollment.course.title}</TableCell>
                          <TableCell>${Number(usage.discountAmount).toFixed(2)}</TableCell>
                          <TableCell>
                            {format(new Date(usage.createdAt), "d MMM yyyy, HH:mm", { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Aucune statistique disponible
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

