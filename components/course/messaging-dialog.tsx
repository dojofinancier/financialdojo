"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor } from "@/components/admin/courses/rich-text-editor";
import { FileUploadButton } from "@/components/admin/courses/file-upload-button";
import { sendMessageAction, getThreadMessagesAction, getMessageThreadsAction } from "@/app/actions/messages";
import { toast } from "sonner";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

interface MessagingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentItemId: string;
  courseId: string;
}

export function MessagingDialog({
  open,
  onOpenChange,
  contentItemId,
  courseId,
}: MessagingDialogProps) {
  const [message, setMessage] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      const result = await getThreadMessagesAction(threadId);
      if (result) {
        setMessages(result.messages || []);
      }
    } catch (error) {
      toast.error("Error loading messages");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (open && threadId) {
      loadMessages();
    }
  }, [open, threadId, loadMessages]);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      setSending(true);
      const result = await sendMessageAction({
        threadId: threadId || undefined,
        contentItemId,
        courseId: courseId, // Pass as fallback, will be overridden by contentItem if available
        content: message,
        attachments,
      });

      if (result.success) {
        if (!threadId && result.data?.thread?.id) {
          setThreadId(result.data.thread.id);
        }
        setMessage("");
        setAttachments([]);
        await loadMessages();
        toast.success("Message sent");
      } else {
        toast.error(result.error || "Error sending");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = (fileUrl: string) => {
    setAttachments((prev) => [...prev, fileUrl]);
    // TODO: Attach file URL to message when sending
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ask a question</DialogTitle>
          <DialogDescription>
            Ask your instructor a question about this content
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-[300px] max-h-[400px] border rounded-md p-4 mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Send your first question below</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isFromStudent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.isFromStudent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                    <p className="text-xs opacity-70 mt-2">
                      {format(new Date(msg.createdAt), "d MMM yyyy, HH:mm", { locale: enCA })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-4">
          <div className="space-y-2">
            <RichTextEditor
              content={message}
              onChange={setMessage}
              placeholder="Type your question here..."
            />
          </div>

          <div className="flex items-center gap-2">
            <FileUploadButton
              folder={`messages/${contentItemId}`}
              onUploaded={(url) => handleFileUpload(url)}
              accept="*/*"
               label="Attach a file"
            />

            {attachments.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <span>{attachments.length} file(s) attached</span>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="ml-auto"
            >
              {sending ? (
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

