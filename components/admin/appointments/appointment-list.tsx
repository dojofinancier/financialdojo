"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAppointmentsAction,
} from "@/app/actions/appointments";
import { toast } from "sonner";
import { Loader2, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import Link from "next/link";

type AppointmentItem = {
  id: string;
  scheduledAt: Date;
  status: string;
  notes: string | null;
  durationMinutes: number;
  amount: number | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  course: {
    id: string;
    title: string;
  } | null;
};

export function AppointmentList() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadAppointments = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getAppointmentsAction({
        cursor: cursor || undefined,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      
      const sortByNewest = (items: AppointmentItem[]) =>
        [...items].sort((a, b) => {
          const timeDiff = new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
          if (timeDiff !== 0) return timeDiff;
          return b.id.localeCompare(a.id);
        });

      if (cursor) {
        setAppointments((prev) => {
          const merged = [...prev, ...result.items];
          const unique = new Map(merged.map((item) => [item.id, item]));
          return sortByNewest(Array.from(unique.values()));
        });
      } else {
        setAppointments(sortByNewest(result.items));
      }

      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date"
          placeholder="To"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[150px]"
        />
        <Button onClick={() => loadAppointments()} variant="outline">
          Filter
        </Button>
      </div>

      {loading && appointments.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No appointments found
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & time</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(appointment.scheduledAt), "d MMM yyyy", { locale: enUS })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(appointment.scheduledAt), "HH:mm", { locale: enUS })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {appointment.user.firstName || appointment.user.lastName
                            ? `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim()
                            : "No name"}
                        </div>
                        <div className="text-sm text-muted-foreground">{appointment.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {appointment.course ? (
                        <div className="max-w-xs truncate">{appointment.course.title}</div>
                      ) : (
                        <span className="text-muted-foreground">No course</span>
                      )}
                    </TableCell>
                    <TableCell>{appointment.durationMinutes} min</TableCell>
                    <TableCell>
                      {appointment.amount ? (
                        <span>{appointment.amount.toFixed(2)}$ CAD</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    <TableCell>
                      {appointment.notes ? (
                        <div className="max-w-xs truncate text-sm">{appointment.notes}</div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/admin/appointments/${appointment.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadAppointments(nextCursor)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

