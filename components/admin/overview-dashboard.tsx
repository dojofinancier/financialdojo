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
  getEnrollmentStatisticsAction,
  getDetailedCompletionRatesAction,
  getUserEngagementAction,
  getCourseMetricsAction,
} from "@/app/actions/analytics";
import {
  getTotalRevenueAction,
  getRevenueByPeriodAction,
  getSubscriptionStatisticsAction,
  getRevenueTrendsAction,
} from "@/app/actions/financials";
import { exportFinancialsToCSV } from "@/lib/utils/csv-export";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users, BookOpen, TrendingUp, Clock, DollarSign, Download } from "lucide-react";
import { EnrollmentChart } from "./analytics/enrollment-chart";
import { CompletionRatesChart } from "./analytics/completion-rates-chart";
import { CourseMetricsTable } from "./analytics/course-metrics-table";
import { RevenueChart } from "./financials/revenue-chart";
import { RevenueByCourseChart } from "./financials/revenue-by-course-chart";

export function OverviewDashboard() {
  const [loading, setLoading] = useState(true);
  
  // Analytics state
  const [enrollmentStats, setEnrollmentStats] = useState<any>(null);
  const [completionRates, setCompletionRates] = useState<any>(null);
  const [userEngagement, setUserEngagement] = useState<any>(null);
  const [courseMetrics, setCourseMetrics] = useState<any>(null);
  
  // Financials state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<any>(null);
  const [periodRevenue, setPeriodRevenue] = useState<any>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<any>(null);
  const [revenueTrends, setRevenueTrends] = useState<any>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load critical data first (without revenue trends for faster initial load)
      const [
        enrollmentResult,
        completionResult,
        engagementResult,
        metricsResult,
        totalResult,
        periodResult,
        subscriptionResult,
      ] = await Promise.all([
        getEnrollmentStatisticsAction(),
        getDetailedCompletionRatesAction(),
        getUserEngagementAction(),
        getCourseMetricsAction(),
        getTotalRevenueAction(),
        getRevenueByPeriodAction(selectedYear, selectedMonth || undefined),
        getSubscriptionStatisticsAction(),
      ]);

      if (enrollmentResult.success) setEnrollmentStats(enrollmentResult.data);
      if (completionResult.success) setCompletionRates(completionResult.data);
      if (engagementResult.success) setUserEngagement(engagementResult.data);
      if (metricsResult.success) setCourseMetrics(metricsResult.data);
      if (totalResult.success) setTotalRevenue(totalResult.data);
      if (periodResult.success) setPeriodRevenue(periodResult.data);
      if (subscriptionResult.success) setSubscriptionStats(subscriptionResult.data);
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueTrends = async () => {
    if (revenueTrends) return; // Already loaded
    setTrendsLoading(true);
    try {
      const trendsResult = await getRevenueTrendsAction();
      if (trendsResult.success) setRevenueTrends(trendsResult.data);
    } catch (error) {
      toast.error("Error loading trends");
    } finally {
      setTrendsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Load revenue trends separately after a short delay for better UX
    const trendsTimer = setTimeout(() => {
      loadRevenueTrends();
    }, 500);
    return () => clearTimeout(trendsTimer);
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

  if (loading && !enrollmentStats && !totalRevenue) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Filters */}
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

      {/* Summary Cards - Combined Analytics & Financials */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Financial Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenu total (net)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
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
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
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

        {/* Analytics Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total enrollments</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {enrollmentStats?.totalEnrollments || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Active: {enrollmentStats?.activeEnrollments || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Expired: {enrollmentStats?.expiredEnrollments || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active users</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5" />
              {userEngagement?.activeUsers || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total: {userEngagement?.totalUsers || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Last 30 days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average completion rate</CardDescription>
            <CardTitle className="text-2xl">
              {completionRates && completionRates.length > 0
                ? (
                    completionRates.reduce(
                      (sum: number, c: any) => sum + c.averageCompletionRate,
                      0
                    ) / completionRates.length
                  ).toFixed(1)
                : "0.0"}
              %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              All courses
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average time per student</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {userEngagement?.averageTimeSpent
                ? Math.round(userEngagement.averageTimeSpent / 60)
                : 0}
              min
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Total time spent
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Financials */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trends (last 12 months)</CardTitle>
            <CardDescription>Net revenue per month</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : revenueTrends?.months ? (
              <RevenueChart data={revenueTrends.months} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <span>Loading trends...</span>
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

      {/* Charts - Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollments by course</CardTitle>
            <CardDescription>Top 10 courses by enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentStats?.enrollmentsByCourse ? (
              <EnrollmentChart data={enrollmentStats.enrollmentsByCourse.slice(0, 10)} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion rate by course</CardTitle>
            <CardDescription>Average completion percentage</CardDescription>
          </CardHeader>
          <CardContent>
            {completionRates ? (
              <CompletionRatesChart data={completionRates} />
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course Metrics Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course metrics</CardTitle>
              <CardDescription>
                Enrollment, completion, and engagement details
              </CardDescription>
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {courseMetrics ? (
            <CourseMetricsTable data={courseMetrics} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
