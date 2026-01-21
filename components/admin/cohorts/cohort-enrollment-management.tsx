"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Users, Search, Calendar, Clock, Edit, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getCohortEnrollmentsAction,
  extendCohortEnrollmentAccessAction,
  revokeCohortEnrollmentAccessAction,
} from "@/app/actions/cohort-enrollments";
import { getCohortAction } from "@/app/actions/cohorts";
import { toast } from "sonner";
import { isPast } from "date-fns";

type CohortEnrollment = {
  id: string;
  userId: string;
  cohortId: string;
  purchaseDate: Date;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

interface CohortEnrollmentManagementProps {
  cohortId: string;
}

export function CohortEnrollmentManagement({
  cohortId,
}: CohortEnrollmentManagementProps) {
  const [enrollments, setEnrollments] = useState<CohortEnrollment[]>([]);
  const [cohort, setCohort] = useState<{ maxStudents: number; enrollmentClosingDate: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<CohortEnrollment | null>(null);
  const [extensionDays, setExtensionDays] = useState("30");

  const loadData = async () => {
    try {
      setLoading(true);
      const [enrollmentsResult, cohortResult] = await Promise.all([
        getCohortEnrollmentsAction(cohortId),
        getCohortAction(cohortId),
      ]);

      if (enrollmentsResult.success && enrollmentsResult.data) {
        setEnrollments(enrollmentsResult.data as CohortEnrollment[]);
      }

      if (cohortResult.success && cohortResult.data) {
        setCohort({
          maxStudents: cohortResult.data.maxStudents,
          enrollmentClosingDate: new Date(cohortResult.data.enrollmentClosingDate),
        });
      }
    } catch (error) {
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cohortId]);

  const handleExtendAccess = async () => {
    if (!selectedEnrollment || !extensionDays) {
      return;
    }

    try {
      const days = parseInt(extensionDays, 10);
      if (isNaN(days) || days <= 0) {
        toast.error("The number of days must be a positive number");
        return;
      }

      const result = await extendCohortEnrollmentAccessAction(selectedEnrollment.id, days);
      if (result.success) {
        toast.success(`Accès étendu de ${days} jours`);
        setExtendDialogOpen(false);
        setSelectedEnrollment(null);
        setExtensionDays("30");
        loadData();
      } else {
        toast.error(result.error || "Error extending");
      }
    } catch (error) {
      toast.error("Error extending access");
    }
  };

  const handleRevokeAccess = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to revoke this student's access?")) {
      return;
    }

    try {
      const result = await revokeCohortEnrollmentAccessAction(enrollmentId);
      if (result.success) {
        toast.success("Access revoked successfully");
        loadData();
      } else {
        toast.error(result.error || "Error revoking");
      }
    } catch (error) {
      toast.error("Error while revoking access");
    }
  };

  const openExtendDialog = (enrollment: CohortEnrollment) => {
    setSelectedEnrollment(enrollment);
    setExtensionDays("30");
    setExtendDialogOpen(true);
  };

  const activeEnrollments = enrollments.filter((e) => !isPast(new Date(e.expiresAt)));
  const expiredEnrollments = enrollments.filter((e) => isPast(new Date(e.expiresAt)));

  const filteredActiveEnrollments = activeEnrollments.filter((enrollment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      enrollment.user.email.toLowerCase().includes(query) ||
      (enrollment.user.firstName && enrollment.user.firstName.toLowerCase().includes(query)) ||
      (enrollment.user.lastName && enrollment.user.lastName.toLowerCase().includes(query))
    );
  });

  const filteredExpiredEnrollments = expiredEnrollments.filter((enrollment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      enrollment.user.email.toLowerCase().includes(query) ||
      (enrollment.user.firstName && enrollment.user.firstName.toLowerCase().includes(query)) ||
      (enrollment.user.lastName && enrollment.user.lastName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Gestion des inscriptions</h3>
        <p className="text-sm text-muted-foreground">
          Gérez les inscriptions à cette cohorte
        </p>
      </div>

      {/* Stats */}
      {cohort && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inscriptions actives</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeEnrollments.length}</div>
              <p className="text-xs text-muted-foreground">
                sur {cohort.maxStudents} maximum
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inscriptions expirées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiredEnrollments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Places disponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.max(0, cohort.maxStudents - activeEnrollments.length)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <div className="space-y-6">
          {/* Active Enrollments */}
          {filteredActiveEnrollments.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3">Inscriptions actives</h4>
              <div className="space-y-2">
                {filteredActiveEnrollments.map((enrollment) => (
                  <Card key={enrollment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {enrollment.user.firstName || enrollment.user.lastName
                              ? `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim()
                              : enrollment.user.email}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {enrollment.user.email}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openExtendDialog(enrollment)}
                            title="Extend access"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeAccess(enrollment.id)}
                            title="Revoke access"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Date d'inscription</div>
                          <div className="font-medium">
                            {format(new Date(enrollment.purchaseDate), "d MMMM yyyy", { locale: fr })}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Expire le</div>
                          <div className="font-medium">
                            {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {Math.ceil(
                            (new Date(enrollment.expiresAt).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )}{" "}
                          jours restants
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Expired Enrollments */}
          {filteredExpiredEnrollments.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3">Inscriptions expirées</h4>
              <div className="space-y-2">
                {filteredExpiredEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {enrollment.user.firstName || enrollment.user.lastName
                              ? `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim()
                              : enrollment.user.email}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {enrollment.user.email}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Expiré le</div>
                        <div className="font-medium">
                          {format(new Date(enrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {enrollments.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Aucune inscription</h3>
                <p className="text-muted-foreground">
                  Aucun étudiant n'est inscrit à cette cohorte
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Extend Access Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Étendre l'accès</DialogTitle>
            <DialogDescription>
              Ajoutez des jours d'accès supplémentaires pour cet étudiant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEnrollment && (
              <div className="space-y-2">
                <Label>Étudiant</Label>
                <div className="text-sm">
                  {selectedEnrollment.user.firstName || selectedEnrollment.user.lastName
                    ? `${selectedEnrollment.user.firstName || ""} ${selectedEnrollment.user.lastName || ""}`.trim()
                    : selectedEnrollment.user.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedEnrollment.user.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  Expire actuellement le:{" "}
                  {format(new Date(selectedEnrollment.expiresAt), "d MMMM yyyy", { locale: fr })}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre de jours à ajouter</Label>
              <Input
                type="number"
                min="1"
                value={extensionDays}
                onChange={(e) => setExtensionDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleExtendAccess}>Étendre</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

