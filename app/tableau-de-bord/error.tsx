"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, Mail } from "lucide-react";
import { logClientErrorAction } from "@/app/actions/error-logs";
import { useRouter } from "next/navigation";

export default function DashboardError({
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
      errorMessage: error.message || "Dashboard error",
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
            <CardTitle>Dashboard error</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {error.digest && (
              <p className="mb-2 font-mono text-xs">
                <strong>Error ID:</strong> {error.digest}
              </p>
            )}
            <p>
              Please try again or contact support if the issue persists.
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
              Try again
            </Button>
            <Button onClick={() => router.push("/")} className="flex-1" variant="outline">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

