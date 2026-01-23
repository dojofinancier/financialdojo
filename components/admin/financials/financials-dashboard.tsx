"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTotalRevenueAction,
  getRevenueByPeriodAction,
  getSubscriptionStatisticsAction,
  getRevenueTrendsAction,
} from "@/app/actions/financials";
import { exportFinancialsToCSV } from "@/lib/utils/csv-export";
import { toast } from "sonner";
import { Loader2, Download, DollarSign, TrendingUp, Users, RefreshCw } from "lucide-react";
import { RevenueChart } from "./revenue-chart";
import { RevenueByCourseChart } from "./revenue-by-course-chart";

export function FinancialsDashboard() {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<any>(null);
  const [periodRevenue, setPeriodRevenue] = useState<any>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<any>(null);
  const [revenueTrends, setRevenueTrends] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [totalResult, periodResult, subscriptionResult, trendsResult] = await Promise.all([
        getTotalRevenueAction(),
        getRevenueByPeriodAction(selectedYear, selectedMonth || undefined),
        getSubscriptionStatisticsAction(),
        getRevenueTrendsAction(),
      ]);

      if (totalResult.success) setTotalRevenue(totalResult.data);
      if (periodResult.success) setPeriodRevenue(periodResult.data);
      if (subscriptionResult.success) setSubscriptionStats(subscriptionResult.data);
      if (trendsResult.success) setRevenueTrends(trendsResult.data);
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const handleExportCSV = async () => {
    try {
      const result = await getRevenueByPeriodAction(selectedYear, selectedMonth || undefined);
      if (result.success && result.data) {
        exportFinancialsToCSV(result.data, selectedYear, selectedMonth);
        toast.success("CSV export generated");
      }
    } catch (error) {
      toast.error("Error exporting");
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading && !totalRevenue) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedMonth?.toString() || "all"}
            onValueChange={(v) => setSelectedMonth(v === "all" ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {new Date(selectedYear, month - 1, 1).toLocaleDateString("fr-CA", {
                    month: "long",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenu total (net)</CardDescription>
            <CardTitle className="text-2xl">
              ${totalRevenue?.netRevenue?.toFixed(2) || "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Brut: ${totalRevenue?.grossRevenue?.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-muted-foreground">
              Remboursements: ${totalRevenue?.totalRefunds?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Revenu {selectedMonth ? "du mois" : "of the year"}
            </CardDescription>
            <CardTitle className="text-2xl">
              ${periodRevenue?.netRevenue?.toFixed(2) || "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Brut: ${periodRevenue?.grossRevenue?.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-muted-foreground">
              Remboursements: ${periodRevenue?.totalRefunds?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active subscriptions</CardDescription>
            <CardTitle className="text-2xl">
              {subscriptionStats?.activeSubscriptions || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total: {subscriptionStats?.totalSubscriptions || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Churn rate: {subscriptionStats?.churnRate?.toFixed(1) || "0.0"}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated monthly revenue</CardDescription>
            <CardTitle className="text-2xl">
              ${subscriptionStats?.estimatedMonthlyRevenue?.toFixed(2) || "0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Recurring subscriptions
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trends (last 12 months)</CardTitle>
            <CardDescription>Net revenue per month</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueTrends?.months ? (
              <RevenueChart data={revenueTrends.months} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by course</CardTitle>
            <CardDescription>Total revenue by course</CardDescription>
          </CardHeader>
          <CardContent>
            {totalRevenue?.revenueByCourse ? (
              <RevenueByCourseChart data={totalRevenue.revenueByCourse} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

