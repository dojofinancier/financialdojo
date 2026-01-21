"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, Mail, GraduationCap } from "lucide-react";
import { logClientErrorAction } from "@/app/actions/error-logs";
import { useRouter } from "next/navigation";

export default function CohortError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log error to database via server action
    logClientErrorAction({
      errorMessage: error.message || "Error loading cohort",
      stackTrace: error.stack || undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
      severity: "HIGH",
    }).catch((logError) => {
      console.error("Failed to log error:", logError);
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Erreur lors du chargement de la cohorte</CardTitle>
          </div>
          <CardDescription>
            Une erreur s'est produite lors du chargement de la cohorte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {error.digest && (
              <p className="mb-2 font-mono text-xs">
                <strong>ID d'erreur:</strong> {error.digest}
              </p>
            )}
            <p>
              Veuillez réessayer ou retourner au tableau de bord pour accéder à vos cohortes.
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a
              href="mailto:support@ledojofinancier.com"
              className="text-sm text-primary hover:underline"
            >
              support@ledojofinancier.com
            </a>
          </div>

          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1" variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
            <Button
              onClick={() => router.push("/dashboard/student?tab=cohorts")}
              className="flex-1"
              variant="outline"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Mes cohortes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

