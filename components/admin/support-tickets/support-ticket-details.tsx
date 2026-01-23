"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  replyToTicketAction,
  updateTicketStatusAction,
  updateTicketPriorityAction,
  updateTicketCategoryAction,
  assignTicketAction,
  getAdminUsersAction,
} from "@/app/actions/support-tickets";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { User, MessageSquare, Send, Settings, UserPlus } from "lucide-react";
import Link from "next/link";

type TicketDetails = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  assignedAdmin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  replies: Array<{
    id: string;
    message: string;
    createdAt: Date;
    author: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    authorRole: string;
  }>;
};

interface SupportTicketDetailsProps {
  ticket: TicketDetails;
}

export function SupportTicketDetails({ ticket: initialTicket }: SupportTicketDetailsProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    if (assignDialogOpen) {
      loadAdmins();
    }
  }, [assignDialogOpen]);

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    const result = await getAdminUsersAction();
    if (result.success) {
      setAdmins(result.data ?? []);
    }
    setLoadingAdmins(false);
  };

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      toast.error("Message is required");
      return;
    }

    setSendingReply(true);
    try {
      const result = await replyToTicketAction(ticket.id, { message: replyMessage });
      if (result.success) {
        toast.success("Response sent");
        setReplyMessage("");
        window.location.reload();
      } else {
        toast.error(result.error || "Error sending");
      }
    } catch (error) {
      toast.error("Error sending");
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    const result = await updateTicketStatusAction(ticket.id, status as any);
    if (result.success) {
      toast.success("Status updated");
      setTicket({ ...ticket, status });
    } else {
      toast.error(result.error || "Error");
    }
  };

  const handlePriorityChange = async (priority: string) => {
    const result = await updateTicketPriorityAction(ticket.id, priority as any);
    if (result.success) {
      toast.success("Priority updated");
      setTicket({ ...ticket, priority });
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleCategoryChange = async (category: string) => {
    const result = await updateTicketCategoryAction(ticket.id, category || null);
    if (result.success) {
      toast.success("Category updated");
      setTicket({ ...ticket, category: category || null });
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleAssign = async () => {
    if (!selectedAdminId) {
      toast.error("Select an administrator");
      return;
    }

    const result = await assignTicketAction(ticket.id, selectedAdminId);
    if (result.success) {
      toast.success("Ticket assigned");
      const assignedAdmin = admins.find((a) => a.id === selectedAdminId);
      setTicket({ ...ticket, assignedAdmin: assignedAdmin || null });
      setAssignDialogOpen(false);
      setSelectedAdminId("");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="default">Open</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500">In progress</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "CLOSED":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="destructive">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Original ticket */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{ticket.student.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(ticket.createdAt), "d MMMM yyyy, HH:mm", { locale: enCA })}
                  </div>
                </div>
                <Badge variant="outline">Student</Badge>
              </div>
              <div className="mt-2">
                <div className="font-semibold mb-2">{ticket.subject}</div>
                <div className="text-sm whitespace-pre-wrap">{ticket.description}</div>
              </div>
            </div>

            {/* Replies */}
            {ticket.replies.map((reply) => (
              <div
                key={reply.id}
                className={`border rounded-lg p-4 space-y-2 ${
                  reply.authorRole === "ADMIN" ? "bg-muted/50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">
                      {reply.author.firstName || reply.author.lastName
                        ? `${reply.author.firstName || ""} ${reply.author.lastName || ""}`.trim()
                        : reply.author.email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(reply.createdAt), "d MMMM yyyy, HH:mm", { locale: enCA })}
                    </div>
                  </div>
                  <Badge variant={reply.authorRole === "ADMIN" ? "default" : "outline"}>
                    {reply.authorRole === "ADMIN" ? "Admin" : "Student"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{reply.message}</div>
              </div>
            ))}

            {/* Reply form */}
            <div className="border-t pt-4 space-y-4">
              <div>
                <Label htmlFor="reply">Reply</Label>
                <Textarea
                  id="reply"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response..."
                  rows={4}
                  className="mt-2"
                />
              </div>
              <Button onClick={handleReply} disabled={sendingReply || !replyMessage.trim()}>
                {sendingReply ? (
                  <>
                    <Send className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={ticket.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Input
                value={ticket.category || ""}
                onChange={(e) => handleCategoryChange(e.target.value)}
                placeholder="Category..."
                className="mt-2"
              />
            </div>

            <div>
              <Label>Assigned to</Label>
              <div className="mt-2 space-y-2">
                {ticket.assignedAdmin ? (
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span>
                      {ticket.assignedAdmin.firstName || ticket.assignedAdmin.lastName
                        ? `${ticket.assignedAdmin.firstName || ""} ${ticket.assignedAdmin.lastName || ""}`.trim()
                        : ticket.assignedAdmin.email}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Unassigned</div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Student information</Label>
              <div className="mt-2 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Email:</span> {ticket.student.email}
                </div>
                <Link href={`/dashboard/admin/students/${ticket.student.id}`}>
                  <Button variant="link" size="sm" className="p-0 h-auto">
                    View profile
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign ticket</DialogTitle>
            <DialogDescription>
              Select an admin to assign this ticket
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an administrator" />
              </SelectTrigger>
              <SelectContent>
                {loadingAdmins ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.firstName || admin.lastName
                        ? `${admin.firstName || ""} ${admin.lastName || ""}`.trim()
                        : admin.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selectedAdminId}>
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

