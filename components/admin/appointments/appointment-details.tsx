"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateAppointmentAction,
} from "@/app/actions/appointments";
import { toast } from "sonner";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, User, BookOpen, Settings } from "lucide-react";
import Link from "next/link";

type AppointmentDetails = {
  id: string;
  scheduledAt: Date;
  status: string;
  notes: string | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
  course: {
    id: string;
    title: string;
  } | null;
};

interface AppointmentDetailsProps {
  appointment: AppointmentDetails;
}

export function AppointmentDetails({ appointment: initialAppointment }: AppointmentDetailsProps) {
  const [appointment, setAppointment] = useState(initialAppointment);

  const handleStatusChange = async (status: string) => {
    const result = await updateAppointmentAction(appointment.id, { status: status as any });
    if (result.success) {
      toast.success("Status updated");
      setAppointment({ ...appointment, status });
    } else {
      toast.error(result.error || "Error");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "CONFIRMED":
        return <Badge className="bg-blue-500">Confirmed</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">
                {appointment.user.firstName || appointment.user.lastName
                  ? `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim()
                  : "No name"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{appointment.user.email}</p>
            </div>
            {appointment.user.phone && (
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p className="font-medium">{appointment.user.phone}</p>
              </div>
            )}
            <div>
              <Link href={`/dashboard/admin/students/${appointment.user.id}`}>
                <Button variant="outline" size="sm">
                  View student profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Date & time</Label>
              <p className="font-medium">
                {format(new Date(appointment.scheduledAt), "d MMMM yyyy, HH:mm", { locale: enUS })}
              </p>
            </div>
            {appointment.course && (
              <div>
                <Label className="text-muted-foreground">Course</Label>
                <p className="font-medium">{appointment.course.title}</p>
                <Link href={`/dashboard/admin/courses/${appointment.course.id}`}>
                  <Button variant="link" size="sm" className="p-0 h-auto mt-1">
                    View course
                  </Button>
                </Link>
              </div>
            )}
            {appointment.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={appointment.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2">
            Current status: {getStatusBadge(appointment.status)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

