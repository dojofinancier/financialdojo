import { Suspense } from "react";
import { PaiementPageClient } from "./payment-page-client";

export default function PaiementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      }
    >
      <PaiementPageClient />
    </Suspense>
  );
}

