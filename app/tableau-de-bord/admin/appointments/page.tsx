import { requireAdmin } from "@/lib/auth/require-auth";
import { AppointmentList } from "@/components/admin/appointments/appointment-list";
import { AvailabilityManagement } from "@/components/admin/appointments/availability-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminAppointmentsPage() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Appointment management</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage all appointments with students
        </p>
      </div>
      <Tabs defaultValue="appointments" className="w-full">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments">
          <AppointmentList />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

