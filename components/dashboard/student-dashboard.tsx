"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BookOpen, User, Calendar, HelpCircle, Menu, GraduationCap } from "lucide-react";
const CoursesTab = lazy(() => import("./tabs/courses-tab").then((m) => ({ default: m.CoursesTab })));
const CohortsTab = lazy(() => import("./tabs/cohorts-tab").then((m) => ({ default: m.CohortsTab })));
const ProfileTab = lazy(() => import("./tabs/profile-tab").then((m) => ({ default: m.ProfileTab })));
const AppointmentsTab = lazy(() => import("./tabs/appointments-tab").then((m) => ({ default: m.AppointmentsTab })));
const SupportTab = lazy(() => import("./tabs/support-tab").then((m) => ({ default: m.SupportTab })));

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
};

type Enrollment = {
  id: string;
  courseId: string;
  purchaseDate: Date;
  expiresAt: Date;
  paymentIntentId: string | null;
  course: {
    id: string;
    title: string;
    code: string | null;
    slug: string | null;
    category: {
      name: string;
    };
  };
};

type CohortEnrollment = {
  id: string;
  cohortId: string;
  purchaseDate: Date;
  expiresAt: Date;
  paymentIntentId: string | null;
  cohort: {
    id: string;
    title: string;
    slug: string | null;
    instructor: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
};

interface StudentDashboardProps {
  user: User;
  initialEnrollments: Enrollment[];
  initialCohortEnrollments?: CohortEnrollment[];
}

const TabLoading = () => (
  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
    Loading...
  </div>
);

export function StudentDashboard({
  user,
  initialEnrollments,
  initialCohortEnrollments = [],
}: StudentDashboardProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"courses" | "cohorts" | "profile" | "appointments" | "support">("courses");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "cohorts" || tab === "profile" || tab === "appointments" || tab === "support") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
          Your Dashboard
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Welcome, {user.firstName || user.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : user.email}
        </p>
      </div>

      {/* Navigation Tabs - Hamburger Menu on Mobile, Tabs on Desktop */}
      <div className="mb-6 md:mb-8">
        {/* Mobile: Hamburger Menu */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  {activeTab === "courses" && (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Courses
                    </>
                  )}
                  {activeTab === "cohorts" && (
                    <>
                      <GraduationCap className="h-4 w-4" />
                      Cohorts
                    </>
                  )}
                  {activeTab === "profile" && (
                    <>
                      <User className="h-4 w-4" />
                      My profile
                    </>
                  )}
                  {activeTab === "appointments" && (
                    <>
                      <Calendar className="h-4 w-4" />
                      Coaching
                    </>
                  )}
                  {activeTab === "support" && (
                    <>
                      <HelpCircle className="h-4 w-4" />
                      Support
                    </>
                  )}
                </span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem
                onClick={() => setActiveTab("courses")}
                className={activeTab === "courses" ? "bg-accent" : ""}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Courses
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("cohorts")}
                className={activeTab === "cohorts" ? "bg-accent" : ""}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Cohorts
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("profile")}
                className={activeTab === "profile" ? "bg-accent" : ""}
              >
                <User className="h-4 w-4 mr-2" />
                My profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("appointments")}
                className={activeTab === "appointments" ? "bg-accent" : ""}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Coaching
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("support")}
                className={activeTab === "support" ? "bg-accent" : ""}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Support
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: Horizontal Buttons */}
        <div className="hidden md:flex flex-wrap gap-2">
          <Button
            variant={activeTab === "courses" ? "default" : "outline"}
            onClick={() => setActiveTab("courses")}
            className="flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Courses
          </Button>
          <Button
            variant={activeTab === "cohorts" ? "default" : "outline"}
            onClick={() => setActiveTab("cohorts")}
            className="flex items-center gap-2"
          >
            <GraduationCap className="h-4 w-4" />
            Cohorts
          </Button>
          <Button
            variant={activeTab === "profile" ? "default" : "outline"}
            onClick={() => setActiveTab("profile")}
            className="flex items-center gap-2"
          >
            <User className="h-4 w-4" />
            My profile
          </Button>
          <Button
            variant={activeTab === "appointments" ? "default" : "outline"}
            onClick={() => setActiveTab("appointments")}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Coaching
          </Button>
          <Button
            variant={activeTab === "support" ? "default" : "outline"}
            onClick={() => setActiveTab("support")}
            className="flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Support
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "courses" && (
          <Suspense fallback={<TabLoading />}>
            <CoursesTab
              enrollments={initialEnrollments}
              cohortEnrollments={[]}
            />
          </Suspense>
        )}
        {activeTab === "cohorts" && (
          <Suspense fallback={<TabLoading />}>
            <CohortsTab cohortEnrollments={initialCohortEnrollments} />
          </Suspense>
        )}
        {activeTab === "profile" && (
          <Suspense fallback={<TabLoading />}>
            <ProfileTab user={user} />
          </Suspense>
        )}
        {activeTab === "appointments" && (
          <Suspense fallback={<TabLoading />}>
            <AppointmentsTab />
          </Suspense>
        )}
        {activeTab === "support" && (
          <Suspense fallback={<TabLoading />}>
            <SupportTab />
          </Suspense>
        )}
      </div>
    </div>
  );
}

