"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, ArrowRight, CheckCircle2, GraduationCap, Users } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import Link from "next/link";
import { isPast } from "date-fns";

type Enrollment = {
  id: string;
  courseId: string;
  purchaseDate: Date;
  expiresAt: Date;
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

interface CoursesTabProps {
  enrollments: Enrollment[];
  cohortEnrollments?: CohortEnrollment[];
}

export function CoursesTab({ enrollments, cohortEnrollments = [] }: CoursesTabProps) {
  const activeEnrollments = enrollments.filter((e) => !isPast(new Date(e.expiresAt)));
  const expiredEnrollments = enrollments.filter((e) => isPast(new Date(e.expiresAt)));
  const activeCohortEnrollments = cohortEnrollments.filter((e) => !isPast(new Date(e.expiresAt)));
  const expiredCohortEnrollments = cohortEnrollments.filter((e) => isPast(new Date(e.expiresAt)));

  const hasAnyActive = activeEnrollments.length > 0 || activeCohortEnrollments.length > 0;
  const hasAnyExpired = expiredEnrollments.length > 0 || expiredCohortEnrollments.length > 0;

  return (
    <div className="space-y-6">
      {!hasAnyActive && !hasAnyExpired ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No enrolled courses</h3>
            <p className="text-muted-foreground mb-4">
              Browse our catalog to discover our courses
            </p>
            <Link href="/courses" prefetch={true}>
              <Button>View catalog</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {hasAnyActive && (
            <div>
              <h2 className="text-xl font-semibold mb-4">My active courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Course Enrollments */}
                {activeEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{enrollment.course.category.name}</Badge>
                        {enrollment.course.code && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {enrollment.course.code}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{enrollment.course.title}</CardTitle>
                      <CardDescription>
                        Enrolled on {format(new Date(enrollment.purchaseDate), "d MMMM yyyy", { locale: enUS })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Expires on</span>
                          <span className="font-medium">
                            {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: enUS })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {Math.ceil(
                              (new Date(enrollment.expiresAt).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24)
                            )}{" "}
                            days remaining
                          </span>
                        </div>
                      </div>
                      {/* This route is heavy (loads full course content). Avoid auto-prefetch from dashboard. */}
                      <Link href={`/learn/${enrollment.course.slug || enrollment.course.id}`} prefetch={false}>
                        <Button className="w-full">
                          Continue learning
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
                {/* Cohort Enrollments */}
                {activeCohortEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          Cohort
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{enrollment.cohort.title}</CardTitle>
                      <CardDescription>
                        Enrolled on {format(new Date(enrollment.purchaseDate), "d MMMM yyyy", { locale: enUS })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Expires on</span>
                          <span className="font-medium">
                            {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: enUS })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {Math.ceil(
                              (new Date(enrollment.expiresAt).getTime() - Date.now()) /
                                (1000 * 60 * 60 * 24)
                            )}{" "}
                            days remaining
                          </span>
                        </div>
                        {enrollment.cohort.instructor && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>
                              Instructor:{" "}
                              {enrollment.cohort.instructor.firstName || enrollment.cohort.instructor.lastName
                                ? `${enrollment.cohort.instructor.firstName || ""} ${enrollment.cohort.instructor.lastName || ""}`.trim()
                                : enrollment.cohort.instructor.email}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Cohort learning route can also be heavy; avoid auto-prefetch from dashboard. */}
                      <Link href={`/cohorts/${enrollment.cohort.slug || enrollment.cohort.id}/learn`} prefetch={false}>
                        <Button className="w-full">
                          Go to cohort
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {hasAnyExpired && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Expired courses</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {expiredEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{enrollment.course.category.name}</Badge>
                        {enrollment.course.code && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {enrollment.course.code}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{enrollment.course.title}</CardTitle>
                      <CardDescription>
                        Expired on {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: enUS })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/courses/${enrollment.course.slug || enrollment.course.id}`} prefetch={true}>
                        <Button variant="outline" className="w-full">
                          Re-enroll
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
                {/* Expired Cohort Enrollments */}
                {expiredCohortEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="opacity-60 border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          Cohort
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{enrollment.cohort.title}</CardTitle>
                      <CardDescription>
                        Expired on {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: enUS })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/cohorts/${enrollment.cohort.slug || enrollment.cohort.id}/learn`} prefetch={true}>
                        <Button variant="outline" className="w-full">
                          View details
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
