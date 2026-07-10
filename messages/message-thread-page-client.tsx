"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getThreadMessagesAdminAction } from "@/app/actions/messages";
import { MessageThreadDetails } from "@/components/admin/messages/message-thread-details";
import { AdminDetailPageLoader } from "@/components/admin/admin-detail-page-loader";

export function MessageThreadPageClient() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const load = useCallback(() => getThreadMessagesAdminAction(threadId), [threadId]);

  return (
    <AdminDetailPageLoader cacheKey={threadId} load={load}>
      {(threadData) => (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard/admin/messages">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to list
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Conversation</h1>
            <p className="text-muted-foreground mt-2">{threadData.thread.subject}</p>
          </div>
          <MessageThreadDetails threadData={threadData} />
        </div>
      )}
    </AdminDetailPageLoader>
  );
}
