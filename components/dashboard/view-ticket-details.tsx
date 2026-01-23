"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replyToTicketAction } from "@/app/actions/support-tickets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

type Ticket = {
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
    authorId: string;
    authorRole: string;
    createdAt: Date;
    author: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
};

interface ViewTicketDetailsProps {
  ticket: Ticket;
}

export function ViewTicketDetails({ ticket }: ViewTicketDetailsProps) {
  const router = useRouter();
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await replyToTicketAction(ticket.id, {
        message: replyMessage,
        attachments: null,
      });

      if (result.success) {
        toast.success("Response sent successfully!");
        setReplyMessage("");
        router.refresh();
      } else {
        toast.error(result.error || "Error sending the response");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ticket Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{ticket.subject}</CardTitle>
              <CardDescription className="mt-2">
                Created on {format(new Date(ticket.createdAt), "d MMMM yyyy 'at' HH:mm", { locale: enCA })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(ticket.status)}
              {getPriorityBadge(ticket.priority)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
            </div>
            {ticket.category && (
              <div>
                <span className="text-sm text-muted-foreground">Category: </span>
                <Badge variant="outline">{ticket.category}</Badge>
              </div>
            )}
            {ticket.assignedAdmin && (
              <div>
                <span className="text-sm text-muted-foreground">Assigned to: </span>
                <span className="font-medium">
                  {ticket.assignedAdmin.firstName} {ticket.assignedAdmin.lastName} (
                  {ticket.assignedAdmin.email})
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            {ticket.replies.length} {ticket.replies.length === 1 ? "response" : "responses"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Initial message */}
          <div className="border-l-4 border-primary pl-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {ticket.student.firstName} {ticket.student.lastName}
                </span>
                <Badge variant="outline">Student</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(ticket.createdAt), "d MMM yyyy 'at' HH:mm", { locale: enCA })}
              </span>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Replies */}
          {ticket.replies.map((reply) => (
            <div
              key={reply.id}
              className={`border-l-4 pl-4 py-2 ${
                reply.authorRole === "ADMIN" ? "border-blue-500" : "border-primary"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {reply.author.firstName} {reply.author.lastName}
                  </span>
                  <Badge variant={reply.authorRole === "ADMIN" ? "default" : "outline"}>
                    {reply.authorRole === "ADMIN" ? "Admin" : "Student"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(reply.createdAt), "d MMM yyyy 'at' HH:mm", { locale: enCA })}
                </span>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))}

          {/* Reply Form */}
          {ticket.status !== "CLOSED" && (
            <form onSubmit={handleReply} className="pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="reply">Add a reply</Label>
                <Textarea
                  id="reply"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response..."
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" disabled={isSubmitting || !replyMessage.trim()} className="mt-4">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

