"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OverviewDashboard } from "./overview-dashboard";
import { CourseTabs } from "./courses/course-tabs";
import { StudentList } from "./students/student-list";
import { OrderList } from "./orders/order-list";
import { CouponTabs } from "./coupons/coupon-tabs";
import { MessageList } from "./messages/message-list";
import { SupportTicketList } from "./support-tickets/support-ticket-list";
import { AppointmentList } from "./appointments/appointment-list";
import { AvailabilityManagement } from "./appointments/availability-management";
import { BookOpen, Users, ShoppingCart, Tag, MessageSquare, Ticket, Calendar, BarChart3, Menu, GraduationCap, AlertCircle, LineChart, Settings } from "lucide-react";
import { ErrorLogViewer } from "./error-logs/error-log-viewer";
import { AccountManagement } from "./account/account-management";

interface AdminDashboardTabsProps {
  defaultTab?: string;
  children?: ReactNode; // Allow custom content to be rendered
}

export function AdminDashboardTabs({ defaultTab = "overview", children }: AdminDashboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab(defaultTab);
    }
  }, [searchParams, defaultTab]);

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    // Navigate to dedicated routes for courses, cohorts, and analytics
    if (tabValue === "courses") {
      router.push("/dashboard/admin/courses");
      return;
    }
    if (tabValue === "cohorts") {
      router.push("/dashboard/admin/cohorts");
      return;
    }
    if (tabValue === "analytics") {
      router.push("/dashboard/admin/analytics");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabValue);
    router.push(`/dashboard/admin?${params.toString()}`);
  };

  return (
    <div className="w-full">
      {/* Navigation - Mobile: Dropdown Menu, Desktop: Horizontal Buttons */}
      <div className="mb-6 md:mb-8">
        {/* Mobile: Dropdown Menu */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  {activeTab === "overview" && (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      Overview
                    </>
                  )}
                  {activeTab === "courses" && (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Courses
                    </>
                  )}
                  {activeTab === "students" && (
                    <>
                      <Users className="h-4 w-4" />
                      Students
                    </>
                  )}
                  {activeTab === "orders" && (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Orders
                    </>
                  )}
                  {activeTab === "coupons" && (
                    <>
                      <Tag className="h-4 w-4" />
                      Coupons
                    </>
                  )}
                  {activeTab === "appointments" && (
                    <>
                      <Calendar className="h-4 w-4" />
                      Appointments
                    </>
                  )}
                  {activeTab === "messages" && (
                    <>
                      <MessageSquare className="h-4 w-4" />
                      Messages
                    </>
                  )}
                  {activeTab === "support" && (
                    <>
                      <Ticket className="h-4 w-4" />
                      Support
                    </>
                  )}
                  {activeTab === "cohorts" && (
                    <>
                      <GraduationCap className="h-4 w-4" />
                      Cohorts
                    </>
                  )}
                  {activeTab === "errors" && (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      Error logs
                    </>
                  )}
                  {activeTab === "analytics" && (
                    <>
                      <LineChart className="h-4 w-4" />
                      Analytics
                    </>
                  )}
                  {activeTab === "account" && (
                    <>
                      <Settings className="h-4 w-4" />
                      Account
                    </>
                  )}
                </span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem
                onClick={() => handleTabChange("overview")}
                className={activeTab === "overview" ? "bg-accent" : ""}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("courses")}
                className={activeTab === "courses" ? "bg-accent" : ""}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Courses
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("students")}
                className={activeTab === "students" ? "bg-accent" : ""}
              >
                <Users className="h-4 w-4 mr-2" />
                Students
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("orders")}
                className={activeTab === "orders" ? "bg-accent" : ""}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Orders
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("coupons")}
                className={activeTab === "coupons" ? "bg-accent" : ""}
              >
                <Tag className="h-4 w-4 mr-2" />
                Coupons
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("appointments")}
                className={activeTab === "appointments" ? "bg-accent" : ""}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Appointments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("messages")}
                className={activeTab === "messages" ? "bg-accent" : ""}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("support")}
                className={activeTab === "support" ? "bg-accent" : ""}
              >
                <Ticket className="h-4 w-4 mr-2" />
                Support
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("cohorts")}
                className={activeTab === "cohorts" ? "bg-accent" : ""}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Cohorts
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("errors")}
                className={activeTab === "errors" ? "bg-accent" : ""}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Error logs
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("analytics")}
                className={activeTab === "analytics" ? "bg-accent" : ""}
              >
                <LineChart className="h-4 w-4 mr-2" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleTabChange("account")}
                className={activeTab === "account" ? "bg-accent" : ""}
              >
                <Settings className="h-4 w-4 mr-2" />
                Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: Horizontal Buttons */}
        <div className="hidden md:flex flex-wrap gap-2">
          <Button
            variant={activeTab === "overview" ? "default" : "outline"}
            onClick={() => handleTabChange("overview")}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Overview
          </Button>
          <Button
            variant={activeTab === "courses" ? "default" : "outline"}
            onClick={() => handleTabChange("courses")}
            className="flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Courses
          </Button>
          <Button
            variant={activeTab === "students" ? "default" : "outline"}
            onClick={() => handleTabChange("students")}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Students
          </Button>
          <Button
            variant={activeTab === "orders" ? "default" : "outline"}
            onClick={() => handleTabChange("orders")}
            className="flex items-center gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Orders
          </Button>
          <Button
            variant={activeTab === "coupons" ? "default" : "outline"}
            onClick={() => handleTabChange("coupons")}
            className="flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            Coupons
          </Button>
          <Button
            variant={activeTab === "appointments" ? "default" : "outline"}
            onClick={() => handleTabChange("appointments")}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Appointments
          </Button>
          <Button
            variant={activeTab === "messages" ? "default" : "outline"}
            onClick={() => handleTabChange("messages")}
            className="flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Messages
          </Button>
          <Button
            variant={activeTab === "support" ? "default" : "outline"}
            onClick={() => handleTabChange("support")}
            className="flex items-center gap-2"
          >
            <Ticket className="h-4 w-4" />
            Support
          </Button>
          <Button
            variant={activeTab === "cohorts" ? "default" : "outline"}
            onClick={() => handleTabChange("cohorts")}
            className="flex items-center gap-2"
          >
            <GraduationCap className="h-4 w-4" />
            Cohorts
          </Button>
          <Button
            variant={activeTab === "errors" ? "default" : "outline"}
            onClick={() => handleTabChange("errors")}
            className="flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Error logs
          </Button>
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => handleTabChange("analytics")}
            className="flex items-center gap-2"
          >
            <LineChart className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            variant={activeTab === "account" ? "default" : "outline"}
            onClick={() => handleTabChange("account")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Account
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewDashboard />}
      {activeTab === "courses" && <CourseTabs defaultTab="list" />}
      {activeTab === "students" && <StudentList />}
      {activeTab === "orders" && <OrderList />}
      {activeTab === "coupons" && <CouponTabs />}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <Tabs defaultValue="appointments" className="w-full">
            <TabsList>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
            </TabsList>
            <TabsContent value="appointments" className="mt-4">
              <AppointmentList />
            </TabsContent>
            <TabsContent value="availability" className="mt-4">
              <AvailabilityManagement />
            </TabsContent>
          </Tabs>
        </div>
      )}
      {activeTab === "messages" && <MessageList />}
      {activeTab === "support" && <SupportTicketList />}
      {activeTab === "errors" && <ErrorLogViewer />}
      {activeTab === "account" && <AccountManagement />}
      {/* Cohorts are handled via dedicated route /dashboard/admin/cohorts */}
      {activeTab === "cohorts" && children ? children : null}
    </div>
  );
}
