"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  replyToMessageThreadAction,
  updateThreadStatusAction,
} from "@/app/actions/messages";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Send, Settings } from "lucide-react";
import Link from "next/link";

type ThreadData = {
  thread: {
    id: string;
    subject: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
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
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    isFromStudent: boolean;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
};

interface MessageThreadDetailsProps {
  threadData: ThreadData;
}

export function MessageThreadDetails({ threadData: initialThreadData }: MessageThreadDetailsProps) {
  const [threadData, setThreadData] = useState(initialThreadData);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      toast.error("Message is required");
      return;
    }

    setSendingReply(true);
    try {
      const result = await replyToMessageThreadAction(threadData.thread.id, replyMessage);
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
    const result = await updateThreadStatusAction(threadData.thread.id, status as any);
    if (result.success) {
      toast.success("Status updated");
      setThreadData({
        ...threadData,
        thread: { ...threadData.thread, status },
      });
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {threadData.messages.map((message) => (
              <div
                key={message.id}
                className={`border rounded-lg p-4 space-y-2 ${
                  !message.isFromStudent ? "bg-muted/50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">
                      {message.user.firstName || message.user.lastName
                        ? `${message.user.firstName || ""} ${message.user.lastName || ""}`.trim()
                        : message.user.email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(message.createdAt), "d MMMM yyyy, HH:mm", { locale: fr })}
                    </div>
                  </div>
                  <Badge variant={message.isFromStudent ? "outline" : "default"}>
                    {message.isFromStudent ? "Student" : "Admin"}
                  </Badge>
                </div>
                <div 
                  className="mt-2 text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              </div>
            ))}

            <div className="border-t pt-4 space-y-4">
              <div>
                <Label htmlFor="reply">Répondre</Label>
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
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
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
              Paramètres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Statut</Label>
              <Select
                value={threadData.thread.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Ouvert</SelectItem>
                  <SelectItem value="CLOSED">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Informations étudiant</Label>
              <div className="mt-2 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Email:</span> {threadData.thread.user.email}
                </div>
                <Link href={`/dashboard/admin/students/${threadData.thread.user.id}`}>
                  <Button variant="link" size="sm" className="p-0 h-auto">
                    Voir le profil
                  </Button>
                </Link>
              </div>
            </div>

            {threadData.thread.course && (
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Cours</Label>
                <div className="mt-2">
                  <div className="text-sm font-medium">{threadData.thread.course.title}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

