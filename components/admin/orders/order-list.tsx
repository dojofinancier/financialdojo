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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOrdersAction,
} from "@/app/actions/orders";
import { exportOrdersToCSV } from "@/lib/utils/csv-export";
import { toast } from "sonner";
import { Loader2, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

type OrderItem = {
  id: string;
  purchaseDate: Date;
  expiresAt: Date;
  paymentIntentId: string | null;
  paymentStatus: string;
  refunded: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  course: {
    id: string;
    title: string;
    price: number;
  };
  couponUsage: {
    coupon: {
      code: string;
      discountAmount: number;
    };
  } | null;
};

export function OrderList() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadOrders = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getOrdersAction({
        cursor: cursor || undefined,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter as any : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      
      if (cursor) {
        setOrders((prev) => [...prev, ...result.items]);
      } else {
        setOrders(result.items);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading orders");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleExportCSV = async () => {
    try {
      // Load all orders for export (no pagination)
      const result = await getOrdersAction({
        limit: 10000, // Large limit to get all
        status: statusFilter !== "all" ? statusFilter as any : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      
      exportOrdersToCSV(result.items);
      toast.success("CSV export generated");
    } catch (error) {
      toast.error("Error exporting");
    }
  };

  const getStatusBadge = (order: OrderItem) => {
    if (order.refunded) {
      return <Badge variant="destructive">Remboursé</Badge>;
    }
    switch (order.paymentStatus) {
      case "succeeded":
        return <Badge className="bg-primary">Complété</Badge>;
      case "requires_payment_method":
      case "requires_confirmation":
        return <Badge variant="secondary">En attente</Badge>;
      case "canceled":
      case "payment_failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="outline">{order.paymentStatus}</Badge>;
    }
  };

  const calculateFinalPrice = (order: OrderItem) => {
    const coursePrice = Number(order.course.price);
    const discount = order.couponUsage ? Number(order.couponUsage.coupon.discountAmount) : 0;
    return Math.max(0, coursePrice - discount);
  };

  const filteredOrders = orders.filter((order) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.user.email.toLowerCase().includes(searchLower) ||
      order.user.firstName?.toLowerCase().includes(searchLower) ||
      order.user.lastName?.toLowerCase().includes(searchLower) ||
      order.course.title.toLowerCase().includes(searchLower) ||
      order.paymentIntentId?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <Input
          placeholder="Search by student, course or payment ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="completed">Complétés</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="refunded">Remboursés</SelectItem>
            <SelectItem value="failed">Échoués</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder="Du"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date"
          placeholder="Au"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[150px]"
        />
        <Button onClick={() => loadOrders()} variant="outline">
          Filtrer
        </Button>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune commande trouvée
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Commande</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Cours</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const finalPrice = calculateFinalPrice(order);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.paymentIntentId?.slice(-8) || order.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {order.user.firstName || order.user.lastName
                              ? `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim()
                              : "Sans nom"}
                          </div>
                          <div className="text-sm text-muted-foreground">{order.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{order.course.title}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">${finalPrice.toFixed(2)}</div>
                          {order.couponUsage && (
                            <div className="text-xs text-muted-foreground">
                              Coupon: {order.couponUsage.coupon.code} (-${Number(order.couponUsage.coupon.discountAmount).toFixed(2)})
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(order.purchaseDate), "d MMM yyyy, HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>{getStatusBadge(order)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/admin/orders/${order.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadOrders(nextCursor)}
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
    </div>
  );
}

