"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  extendEnrollmentAccessAction,
  revokeEnrollmentAccessAction,
  deleteEnrollmentAction,
} from "@/app/actions/enrollments";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Calendar, Clock, BookOpen, TrendingUp, Ban, Trash2, Plus } from "lucide-react";
import type { UserRole } from "@prisma/client";

type EnrollmentWithCourse = {
  id: string;
  purchaseDate: Date;
  expiresAt: Date;
  orderNumber: number | null;
  course: {
    id: string;
    title: string;
    code: string | null;
    category: {
      id: string;
      name: string;
    };
  };
};

type SubscriptionRow = {
  id: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: Date;
  createdAt: Date;
};

type ProgressRow = {
  id: string;
  timeSpent: number;
  completedAt: Date | null;
  lastAccessedAt: Date;
  contentItem?: {
    id: string;
    contentType: string;
    module: {
      id: string;
      title: string;
      course: {
        id: string;
        title: string;
      };
    };
  };
};

type StudentWithDetails = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt: Date | null;
  enrollments: EnrollmentWithCourse[];
  subscriptions: SubscriptionRow[];
  progressTracking: ProgressRow[];
};

interface StudentDetailsProps {
  student: StudentWithDetails;
}

export function StudentDetails({ student }: StudentDetailsProps) {
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [additionalDays, setAdditionalDays] = useState("30");

  const handleExtendAccess = async () => {
    if (!selectedEnrollment) return;
    const days = parseInt(additionalDays, 10);
    if (isNaN(days) || days <= 0) {
      toast.error("Invalid number of days");
      return;
    }
    const result = await extendEnrollmentAccessAction(selectedEnrollment.id, days);
    if (result.success) {
      toast.success(`Access extended by ${days} days`);
      setExtendDialogOpen(false);
      window.location.reload();
    } else {
      toast.error(result.error || "Error extending");
    }
  };

  const handleRevokeAccess = async () => {
    if (!selectedEnrollment) return;
    const result = await revokeEnrollmentAccessAction(selectedEnrollment.id);
    if (result.success) {
      toast.success("Access revoked");
      setRevokeDialogOpen(false);
      window.location.reload();
    } else {
      toast.error(result.error || "Error revoking");
    }
  };

  const handleDeleteEnrollment = async () => {
    if (!selectedEnrollment) return;
    const result = await deleteEnrollmentAction(selectedEnrollment.id);
    if (result.success) {
      toast.success("Enrollment removed");
      setDeleteDialogOpen(false);
      window.location.reload();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const getEnrollmentStatus = (enrollment: { expiresAt: Date }) => {
    const now = new Date();
    const expiresAt = new Date(enrollment.expiresAt);
    if (expiresAt < now) {
      return { label: "Expired", variant: "destructive" as const };
    }
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 7) {
      return { label: `Expires in ${daysUntilExpiry}d`, variant: "secondary" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  const completedItems = student.progressTracking.filter((pt) => pt.completedAt !== null).length;
  const totalTimeSpent = student.progressTracking.reduce((sum, pt) => sum + pt.timeSpent, 0);
  const hoursSpent = Math.floor(totalTimeSpent / 3600);
  const minutesSpent = Math.floor((totalTimeSpent % 3600) / 60);

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{student.email}</p>
              </div>
              {student.firstName && (
                <div>
                  <Label className="text-muted-foreground">First name</Label>
                  <p className="font-medium">{student.firstName}</p>
                </div>
              )}
              {student.lastName && (
                <div>
                  <Label className="text-muted-foreground">Last name</Label>
                  <p className="font-medium">{student.lastName}</p>
                </div>
              )}
              {student.phone && (
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{student.phone}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Signup date</Label>
                <p className="font-medium">
                  {format(new Date(student.createdAt), "d MMMM yyyy", { locale: enCA })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {student.suspendedAt ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : (
                    <Badge className="bg-primary">Active</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Enrollments</Label>
                <p className="text-2xl font-bold">{student.enrollments.length}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Items completed</Label>
                <p className="text-2xl font-bold">{completedItems}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total time</Label>
                <p className="text-2xl font-bold">
                  {hoursSpent}h {minutesSpent}min
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Active subscriptions</Label>
                <p className="text-2xl font-bold">
                  {student.subscriptions.filter((s) => s.status === "ACTIVE").length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="enrollments" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Course enrollments</CardTitle>
            <CardDescription>
              Manage enrollments and course access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.enrollments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No enrollments
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Purchase date</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.enrollments.map((enrollment) => {
                      const status = getEnrollmentStatus(enrollment);
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{enrollment.course.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {enrollment.course.category.name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(enrollment.purchaseDate), "d MMM yyyy", { locale: enCA })}
                          </TableCell>
                          <TableCell>
                            {format(new Date(enrollment.expiresAt), "d MMM yyyy", { locale: enCA })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEnrollment(enrollment);
                                  setExtendDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Extend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEnrollment(enrollment);
                                  setRevokeDialogOpen(true);
                                }}
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                Revoke
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEnrollment(enrollment);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="progress" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              Recent activity and course progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.progressTracking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No progress recorded
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Time spent</TableHead>
                      <TableHead>Last visit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.progressTracking.map((progress) => {
                      const hours = Math.floor(progress.timeSpent / 3600);
                      const minutes = Math.floor((progress.timeSpent % 3600) / 60);
                      return (
                        <TableRow key={progress.id}>
                          <TableCell className="font-medium">
                            {progress.contentItem?.module?.course?.title ?? "—"}
                          </TableCell>
                          <TableCell>{progress.contentItem?.module?.title ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{progress.contentItem?.contentType ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            {hours > 0 ? `${hours}h ` : ""}
                            {minutes}min
                          </TableCell>
                          <TableCell>
                            {format(new Date(progress.lastAccessedAt), "d MMM yyyy, HH:mm", {
                              locale: enCA,
                            })}
                          </TableCell>
                          <TableCell>
                            {progress.completedAt ? (
                              <Badge className="bg-primary">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">In progress</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="subscriptions" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>
              Manage active and past subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.subscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No subscriptions
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Stripe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current period</TableHead>
                      <TableHead>Created date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-mono text-sm">
                          {subscription.stripeSubscriptionId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              subscription.status === "ACTIVE"
                                ? "default"
                                : subscription.status === "CANCELED"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {subscription.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(subscription.currentPeriodEnd), "d MMM yyyy", {
                            locale: enCA,
                          })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(subscription.createdAt), "d MMM yyyy", { locale: enCA })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Extend Access Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend access</DialogTitle>
            <DialogDescription>
              Add extra days to this student's access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Number of additional days</Label>
              <Input
                type="number"
                min="1"
                value={additionalDays}
                onChange={(e) => setAdditionalDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExtendAccess}>Extend</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke access to this course? Access will end immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeAccess}>
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Enrollment Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete enrollment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this enrollment? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEnrollment}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
