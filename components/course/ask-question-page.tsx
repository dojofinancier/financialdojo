"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle,
  Send,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";
import { sendMessageAction, getMessageThreadsAction, getThreadMessagesAction } from "@/app/actions/messages";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load TipTap editor to reduce initial bundle size
const RichTextEditor = lazy(() => import("@/components/admin/courses/rich-text-editor").then(m => ({ default: m.RichTextEditor })));

interface AskQuestionPageProps {
  courseId: string;
  courseTitle: string;
}

interface MessageThread {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    content: string;
    isFromStudent: boolean;
    createdAt: Date;
  }>;
  _count: {
    messages: number;
  };
}

export function AskQuestionPage({ courseId, courseTitle }: AskQuestionPageProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchThreads();
  }, [courseId]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const result = await getMessageThreadsAction({ limit: 100 });
      // Filter threads that are related to this course (via messages with contentItemId)
      // For now, we'll show all threads - you can filter by course if needed
      setThreads(result.items || []);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast.error("Error loading questions");
    } finally {
      setLoading(false);
    }
  };

  const fetchThreadMessages = async (threadId: string) => {
    try {
      const result = await getThreadMessagesAction(threadId);
      if (result) {
        setThreadMessages((prev) => ({
          ...prev,
          [threadId]: result.messages || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching thread messages:", error);
      toast.error("Error loading messages");
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setSubmitting(true);
    try {
      const result = await sendMessageAction({
        content: newQuestion.trim(),
        contentItemId: null, // General course question
        courseId: courseId, // Pass courseId for general questions
      });

      if (result.success) {
        setNewQuestion("");
        await fetchThreads();
        toast.success("Your question has been sent successfully!");
      } else {
        toast.error(result.error || "Error sending the question");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error sending the question");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleThread = (threadId: string) => {
    if (expandedThreadId === threadId) {
      setExpandedThreadId(null);
    } else {
      setExpandedThreadId(threadId);
      if (!threadMessages[threadId]) {
        fetchThreadMessages(threadId);
      }
    }
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), "d MMMM yyyy, HH:mm", { locale: enCA });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading your questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Ask a question</h1>
        <p className="text-muted-foreground">
          Get personalized help for the course: {courseTitle}
        </p>
      </div>
          {/* Submit New Question */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 text-primary mr-2" />
                Ask a new question
              </CardTitle>
              <CardDescription>
                Describe your question or issue in detail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitQuestion} className="space-y-4">
                <div>
                  <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                    <RichTextEditor
                      content={newQuestion}
                      onChange={setNewQuestion}
                      placeholder="Describe your question or problem in detail..."
                    />
                  </Suspense>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!newQuestion.trim() || submitting}
                    className="flex items-center"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send question
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Your Questions */}
          <div>
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <MessageCircle className="h-5 w-5 text-primary mr-2" />
              Your questions ({threads.length})
            </h2>

            {threads.length === 0 ? (
              <Card className="text-center py-12">
                <MessageCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                  No questions asked yet
                </h3>
                <p className="text-muted-foreground">
                  Ask your first question above to get help!
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {threads.map((thread) => {
                  const isExpanded = expandedThreadId === thread.id;
                  // Use loaded messages if available (chronological order), otherwise use thread messages (reverse them to chronological)
                  const loadedMessages = threadMessages[thread.id];
                  const messages = loadedMessages || (thread.messages ? [...thread.messages].reverse() : []);
                  // Check if thread has any non-student messages (admin/instructor responses)
                  const hasResponse = thread.messages?.some((msg) => !msg.isFromStudent) || false;
                  
                  return (
                    <Card key={thread.id} className="overflow-hidden">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">
                              {thread.subject}
                            </CardTitle>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Asked on {formatDate(thread.createdAt)}</span>
                              <div className="flex items-center">
                                {hasResponse ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                                    <span className="text-green-600">Answered</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-4 w-4 mr-1 text-yellow-500" />
                                    <span className="text-yellow-600">Awaiting response</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="ghost"
                          onClick={() => handleToggleThread(thread.id)}
                          className="w-full justify-between"
                        >
                           <span>{isExpanded ? "Hide" : "View"} messages</span>
                          <span className="text-xs text-muted-foreground">
                             {thread._count.messages} message(s)
                          </span>
                        </Button>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 border-t pt-4">
                            {messages.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                Loading messages...
                              </div>
                            ) : (
                              messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`flex ${msg.isFromStudent ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg p-4 ${
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
                                      {formatDate(msg.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 text-primary mr-2" />
                How to ask a good question?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <h4 className="font-medium mb-2">✅ Do:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                     <li>• Be specific and detailed</li>
                     <li>• Mention the chapter or concept</li>
                     <li>• Explain what you already tried</li>
                     <li>• Ask a clear, precise question</li>
                  </ul>
                </div>
                <div>
                   <h4 className="font-medium mb-2">❌ Avoid:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                     <li>• Overly general questions</li>
                     <li>• Asking for exercise answers</li>
                     <li>• Questions unrelated to the course</li>
                     <li>• Messages that are too short or vague</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
    </div>
  );
}

