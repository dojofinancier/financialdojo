import { Suspense } from "react";
import { PaiementSlugClient } from "./paiement-slug-client";

export default function PaiementSlugPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      }
    >
      <PaiementSlugClient />
    </Suspense>
  );
}

