"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAppointmentsAction } from "@/app/actions/appointments";
import { toast } from "sonner";
import { Loader2, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AppointmentBooking } from "./appointment-booking";
import { RescheduleModal } from "./reschedule-modal";

type Appointment = {
  id: string;
  scheduledAt: Date | string; // Can be Date or ISO string
  status: string;
  notes: string | null;
  durationMinutes: number;
  amount: number | null;
  course: {
    id: string;
    title: string;
  } | null;
};

export function AppointmentsTab() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAppointmentsAction({ limit: 100 });
      // Convert scheduledAt strings to Date objects for proper comparison
      const appointmentsWithDates = result.items.map((apt: any) => ({
        ...apt,
        scheduledAt: typeof apt.scheduledAt === 'string' ? new Date(apt.scheduledAt) : apt.scheduledAt,
      }));
      setAppointments(appointmentsWithDates);
    } catch (error) {
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Refresh appointments when tab becomes visible (e.g., after returning from payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadAppointments();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadAppointments]);

  // Also refresh when component mounts (e.g., after redirect)
  useEffect(() => {
    // Small delay to ensure page is fully loaded
    const timer = setTimeout(() => {
      loadAppointments();
    }, 500);
    return () => clearTimeout(timer);
  }, [loadAppointments]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">En attente</Badge>;
      case "CONFIRMED":
        return <Badge className="bg-blue-500">Confirmé</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-500">Terminé</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canReschedule = (appointment: Appointment) => {
    const appointmentDate = appointment.scheduledAt instanceof Date 
      ? appointment.scheduledAt 
      : new Date(appointment.scheduledAt);
    const now = new Date();
    // Can reschedule if appointment is in the future and not already cancelled/completed
    // Must be at least 2 hours before the appointment
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return (
      appointmentDate > twoHoursFromNow &&
      appointment.status !== "CANCELLED" &&
      appointment.status !== "COMPLETED"
    );
  };

  // Ensure scheduledAt is properly converted to Date
  const upcomingAppointments = appointments.filter((apt) => {
    const scheduledDate = apt.scheduledAt instanceof Date ? apt.scheduledAt : new Date(apt.scheduledAt);
    const now = new Date();
    return scheduledDate > now && apt.status !== "CANCELLED";
  });
  const pastAppointments = appointments.filter((apt) => {
    const scheduledDate = apt.scheduledAt instanceof Date ? apt.scheduledAt : new Date(apt.scheduledAt);
    const now = new Date();
    return scheduledDate <= now || apt.status === "CANCELLED";
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showBooking) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setShowBooking(false)}>
            Retour
          </Button>
        </div>
        <AppointmentBooking />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Mes rendez-vous</h2>
          <p className="text-muted-foreground">
            Gérez vos rendez-vous avec les instructeurs
          </p>
        </div>
        <Button onClick={() => setShowBooking(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Réserver
        </Button>
      </div>

      {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun rendez-vous</h3>
            <p className="text-muted-foreground mb-4">
              Planifiez un rendez-vous avec un instructeur
            </p>
            <Button onClick={() => setShowBooking(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Réserver un rendez-vous
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcomingAppointments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Rendez-vous à venir</h3>
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>
                            {format(new Date(appointment.scheduledAt), "d MMMM yyyy, HH:mm", {
                              locale: fr,
                            })}
                          </CardTitle>
                          {appointment.course && (
                            <CardDescription className="mt-1">
                              {appointment.course.title}
                            </CardDescription>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Durée: {appointment.durationMinutes} min</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(appointment.status)}
                          {canReschedule(appointment) && (
                            <RescheduleModal
                              appointment={appointment}
                              onRescheduled={loadAppointments}
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {appointment.notes && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastAppointments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Historique</h3>
              <div className="space-y-4">
                {pastAppointments.map((appointment) => (
                  <Card key={appointment.id} className="opacity-60">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            {format(new Date(appointment.scheduledAt), "d MMMM yyyy, HH:mm", {
                              locale: fr,
                            })}
                          </CardTitle>
                          {appointment.course && (
                            <CardDescription className="mt-1">
                              {appointment.course.title}
                            </CardDescription>
                          )}
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                    </CardHeader>
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

