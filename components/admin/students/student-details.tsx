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
import { fr } from "date-fns/locale";
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
      toast.error("Nombre de jours invalide");
      return;
    }
    const result = await extendEnrollmentAccessAction(selectedEnrollment.id, days);
    if (result.success) {
      toast.success(`Accès prolongé de ${days} jours`);
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
      return { label: `Expire dans ${daysUntilExpiry}j`, variant: "secondary" as const };
    }
    return { label: "Actif", variant: "default" as const };
  };

  const completedItems = student.progressTracking.filter((pt) => pt.completedAt !== null).length;
  const totalTimeSpent = student.progressTracking.reduce((sum, pt) => sum + pt.timeSpent, 0);
  const hoursSpent = Math.floor(totalTimeSpent / 3600);
  const minutesSpent = Math.floor((totalTimeSpent % 3600) / 60);

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="enrollments">Inscriptions</TabsTrigger>
        <TabsTrigger value="progress">Progression</TabsTrigger>
        <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{student.email}</p>
              </div>
              {student.firstName && (
                <div>
                  <Label className="text-muted-foreground">Prénom</Label>
                  <p className="font-medium">{student.firstName}</p>
                </div>
              )}
              {student.lastName && (
                <div>
                  <Label className="text-muted-foreground">Nom</Label>
                  <p className="font-medium">{student.lastName}</p>
                </div>
              )}
              {student.phone && (
                <div>
                  <Label className="text-muted-foreground">Téléphone</Label>
                  <p className="font-medium">{student.phone}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Date d'inscription</Label>
                <p className="font-medium">
                  {format(new Date(student.createdAt), "d MMMM yyyy", { locale: fr })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Statut</Label>
                <div className="mt-1">
                  {student.suspendedAt ? (
                    <Badge variant="destructive">Suspendu</Badge>
                  ) : (
                    <Badge className="bg-primary">Actif</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Inscriptions</Label>
                <p className="text-2xl font-bold">{student.enrollments.length}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Éléments complétés</Label>
                <p className="text-2xl font-bold">{completedItems}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Temps total</Label>
                <p className="text-2xl font-bold">
                  {hoursSpent}h {minutesSpent}min
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Abonnements actifs</Label>
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
            <CardTitle>Inscriptions aux cours</CardTitle>
            <CardDescription>
              Gérez les inscriptions et les accès aux cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.enrollments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune inscription
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cours</TableHead>
                      <TableHead>Date d'achat</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Statut</TableHead>
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
                            {format(new Date(enrollment.purchaseDate), "d MMM yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell>
                            {format(new Date(enrollment.expiresAt), "d MMM yyyy", { locale: fr })}
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
                                Prolonger
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
                                Révoquer
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
            <CardTitle>Progression</CardTitle>
            <CardDescription>
              Activité récente et progression dans les cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.progressTracking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune progression enregistrée
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cours</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Temps passé</TableHead>
                      <TableHead>Dernière visite</TableHead>
                      <TableHead>Statut</TableHead>
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
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell>
                            {progress.completedAt ? (
                              <Badge className="bg-primary">Complété</Badge>
                            ) : (
                              <Badge variant="secondary">En cours</Badge>
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
            <CardTitle>Abonnements</CardTitle>
            <CardDescription>
              Gérer les abonnements actifs et passés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {student.subscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun abonnement
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Stripe</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Période actuelle</TableHead>
                      <TableHead>Date de création</TableHead>
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
                            locale: fr,
                          })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(subscription.createdAt), "d MMM yyyy", { locale: fr })}
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
            <DialogTitle>Prolonger l'accès</DialogTitle>
            <DialogDescription>
              Ajoutez des jours supplémentaires à l'accès de cet étudiant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nombre de jours supplémentaires</Label>
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
                Annuler
              </Button>
              <Button onClick={handleExtendAccess}>Prolonger</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Révoquer l'accès</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir révoquer l'accès à ce cours ? L'accès expirera immédiatement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRevokeAccess}>
              Révoquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Enrollment Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'inscription</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette inscription ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteEnrollment}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

