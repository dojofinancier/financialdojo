import { requireAuth } from "@/lib/auth/require-auth";
import { CreateTicketForm } from "@/components/dashboard/create-ticket-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CreateTicketPage() {
  await requireAuth();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/student">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Créer un ticket de support</h1>
        <p className="text-muted-foreground mt-2">
          Décrivez votre problème et nous vous aiderons rapidement
        </p>
      </div>
      <CreateTicketForm />
    </div>
  );
}

