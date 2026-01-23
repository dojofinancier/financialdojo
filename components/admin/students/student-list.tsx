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
  getStudentsAction,
  suspendStudentAction,
  activateStudentAction,
} from "@/app/actions/students";
import { toast } from "sonner";
import { Loader2, Eye, Ban, CheckCircle2, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import Link from "next/link";
import type { User } from "@prisma/client";

type StudentListItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  suspendedAt: Date | null;
  _count: {
    enrollments: number;
    progressTracking: number;
  };
};

export function StudentList() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [suspendedFilter, setSuspendedFilter] = useState<boolean | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadStudents = useCallback(async (cursor?: string | null) => {
    try {
      setLoading(true);
      const result = await getStudentsAction({
        cursor: cursor || undefined,
        limit: 20,
        search: search || undefined,
        suspended: suspendedFilter,
      });
      if (cursor) {
        setStudents((prev) => [...prev, ...result.items]);
      } else {
        setStudents(result.items);
      }
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading students");
    } finally {
      setLoading(false);
    }
  }, [search, suspendedFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleToggleSuspended = async (student: StudentListItem) => {
    const action = student.suspendedAt ? activateStudentAction : suspendStudentAction;
    const result = await action(student.id);
    if (result.success) {
      toast.success(`Compte ${student.suspendedAt ? "enabled" : "suspendu"}`);
      loadStudents();
    } else {
      toast.error(result.error || "Error updating");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Input
          placeholder="Search by last name, first name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              loadStudents();
            }
          }}
          className="max-w-sm"
        />
        <Select
          value={suspendedFilter === undefined ? "all" : suspendedFilter ? "suspended" : "active"}
          onValueChange={(value) => {
            setSuspendedFilter(
              value === "all" ? undefined : value === "suspended"
            );
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => loadStudents()} variant="outline">
          Search
        </Button>
      </div>

      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No students found
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Signup date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {student.firstName || student.lastName
                            ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
                            : "No name"}
                        </div>
                        <div className="text-sm text-muted-foreground">{student.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3" />
                          {student.email}
                        </div>
                        {student.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {student.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student._count.enrollments}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{student._count.progressTracking} items</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(student.createdAt), "d MMM yyyy", { locale: enCA })}
                    </TableCell>
                    <TableCell>
                      {student.suspendedAt ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge className="bg-primary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/admin/students/${student.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleSuspended(student)}
                        >
                          {student.suspendedAt ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Ban className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
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
                onClick={() => loadStudents(nextCursor)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Charger plus"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

