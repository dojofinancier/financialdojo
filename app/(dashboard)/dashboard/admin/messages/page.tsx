import { requireAdmin } from "@/lib/auth/require-auth";
import { MessageList } from "@/components/admin/messages/message-list";
import { Suspense } from "react";

async function AdminMessagesContent() {
  await requireAdmin();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestion des messages</h1>
        <p className="text-muted-foreground mt-2">
          Review and reply to student questions
        </p>
      </div>
      <MessageList />
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      }
    >
      <AdminMessagesContent />
    </Suspense>
  );
}

