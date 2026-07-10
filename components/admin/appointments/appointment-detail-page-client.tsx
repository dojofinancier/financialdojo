"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppointmentDetailsAction } from "@/app/actions/appointments";
import { AppointmentDetails } from "@/components/admin/appointments/appointment-details";
import { formatInEasternTime } from "@/lib/utils/timezone";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";
import { enCA } from "date-fns/locale";

export function AppointmentDetailPageClient() {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const load = useCallback(() => getAppointmentDetailsAction(appointmentId), [appointmentId]);

  return (
    <AdminDetailPageLoader cacheKey={appointmentId} load={load}>
      {(appointment) => (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/appointments">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Appointment details</h1>
            <p className="text-muted-foreground mt-2">
              {formatInEasternTime(
                new Date(appointment.scheduledAt),
                "EEEE, MMMM d, yyyy 'at' h:mm a",
                { locale: enCA }
              )}
            </p>
          </div>
          <AppointmentDetails appointment={appointment} />
        </div>
      )}
    </AdminDetailPageLoader>
  );
}
