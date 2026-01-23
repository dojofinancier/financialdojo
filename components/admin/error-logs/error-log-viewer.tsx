"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Calendar,
  User,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { getErrorLogsAction, resolveErrorAction } from "@/app/actions/error-logs";
import { toast } from "sonner";

type ErrorLog = {
  id: string;
  errorId: string;
  errorType: "CLIENT" | "SERVER";
  errorMessage: string;
  stackTrace: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolved: boolean;
  createdAt: Date;
  url: string | null;
  userAgent: string | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export function ErrorLogViewer() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [filters, setFilters] = useState({
    resolved: undefined as boolean | undefined,
    severity: undefined as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const loadErrorLogs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getErrorLogsAction({
        resolved: filters.resolved,
        severity: filters.severity,
        limit: 100,
      });
      if (result.items) {
        setErrorLogs(result.items);
      }
    } catch (error) {
      toast.error("Error loading error logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters.resolved, filters.severity]);

  useEffect(() => {
    loadErrorLogs();
  }, [loadErrorLogs]);

  const handleResolve = async (errorId: string) => {
    try {
      const result = await resolveErrorAction(errorId);
      if (result.success) {
        toast.success("Error marked as resolved");
        loadErrorLogs();
      } else {
        toast.error(result.error || "Error while resolving");
      }
    } catch (error) {
      toast.error("Error while resolving");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "Critical";
      case "HIGH":
        return "High";
      case "MEDIUM":
        return "Medium";
      case "LOW":
        return "Low";
      default:
        return severity;
    }
  };

  const filteredLogs = errorLogs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.errorMessage.toLowerCase().includes(query) ||
        log.errorId.toLowerCase().includes(query) ||
        log.user?.email.toLowerCase().includes(query) ||
        log.url?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const unresolvedCount = errorLogs.filter((log) => !log.resolved).length;
  const criticalCount = errorLogs.filter(
    (log) => !log.resolved && log.severity === "CRITICAL"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unresolved errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unresolvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Error logs</CardTitle>
          <CardDescription>
            Review and manage logged errors in the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by message, ID, email, URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={filters.resolved === undefined ? "all" : filters.resolved ? "resolved" : "unresolved"}
              onValueChange={(value) => {
                setFilters({
                  ...filters,
                  resolved: value === "all" ? undefined : value === "resolved",
                });
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.severity || "all"}
              onValueChange={(value) => {
                setFilters({
                  ...filters,
                  severity: value === "all" ? undefined : (value as any),
                });
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadErrorLogs} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Error Logs Table */}
          <div className="border rounded-md">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                     <TableHead>Severity</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No errors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(log.createdAt), "d MMM yyyy HH:mm", { locale: enCA })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.errorType === "CLIENT" ? "Client" : "Serveur"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getSeverityColor(log.severity)} text-white`}
                            variant="default"
                          >
                            {getSeverityLabel(log.severity)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {log.user.firstName || log.user.lastName
                                  ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim()
                                  : log.user.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Anonymous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.resolved ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Unresolved
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedError(log)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Error details</DialogTitle>
                                  <DialogDescription>ID: {log.errorId}</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh]">
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-semibold mb-2">Message</h4>
                                      <p className="text-sm bg-muted p-3 rounded-md">
                                        {log.errorMessage}
                                      </p>
                                    </div>
                                    {log.stackTrace && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Stack Trace</h4>
                                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                                          {log.stackTrace}
                                        </pre>
                                      </div>
                                    )}
                                    {log.url && (
                                      <div>
                                        <h4 className="font-semibold mb-2">URL</h4>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm break-all">{log.url}</span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(log.url!, "_blank")}
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    {log.userAgent && (
                                      <div>
                                        <h4 className="font-semibold mb-2">User Agent</h4>
                                        <p className="text-xs bg-muted p-3 rounded-md break-all">
                                          {log.userAgent}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                            {!log.resolved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResolve(log.errorId)}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

