import { requireAdmin } from "@/lib/auth/require-auth";
import { getAppointmentDetailsAction } from "@/app/actions/appointments";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppointmentDetails } from "@/components/admin/appointments/appointment-details";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface AppointmentDetailPageProps {
  params: Promise<{ appointmentId: string }>;
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  await requireAdmin();
  const { appointmentId } = await params;
  const appointment = await getAppointmentDetailsAction(appointmentId);

  if (!appointment) {
    notFound();
  }

  return (
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
          {format(new Date(appointment.scheduledAt), "d MMMM yyyy, HH:mm", { locale: enUS })}
        </p>
      </div>
      <AppointmentDetails appointment={appointment} />
    </div>
  );
}

