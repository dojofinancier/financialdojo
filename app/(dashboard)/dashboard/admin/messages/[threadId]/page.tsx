import { requireAdmin } from "@/lib/auth/require-auth";
import { getThreadMessagesAdminAction } from "@/app/actions/messages";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MessageThreadDetails } from "@/components/admin/messages/message-thread-details";
import { Suspense } from "react";

interface MessageThreadPageProps {
  params: Promise<{ threadId: string }>;
}

async function MessageThreadContent({ params }: MessageThreadPageProps) {
  await requireAdmin();
  const { threadId } = await params;
  const threadData = await getThreadMessagesAdminAction(threadId);

  if (!threadData) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/admin/messages">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Conversation</h1>
        <p className="text-muted-foreground mt-2">
          {threadData.thread.subject}
        </p>
      </div>
      <MessageThreadDetails threadData={threadData} />
    </div>
  );
}

export default function MessageThreadPage(props: MessageThreadPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement de la conversation...</div>
        </div>
      }
    >
      <MessageThreadContent {...props} />
    </Suspense>
  );
}

