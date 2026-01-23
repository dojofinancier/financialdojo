"use client";

import { useState } from "react";
import { createAdminUserAction } from "@/app/actions/create-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function AdminSetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    data?: any;
  } | null>(null);

  const handleCreateAdmin = async () => {
    setLoading(true);
    setResult(null);

    try {
      const result = await createAdminUserAction();
      setResult(result);

      if (result.success) {
        toast.success("Admin user created successfully!");
      } else {
        toast.error(result.error || "Failed to create admin user");
      }
    } catch (error) {
      toast.error("An error occurred");
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Admin User Setup</CardTitle>
          <CardDescription>
            Create the initial admin user for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will create an admin user with the following credentials:
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-1">
              <p className="text-sm">
                <strong>Email:</strong> admin@dojofinancier.com
              </p>
              <p className="text-sm">
                <strong>Password:</strong> passeport
              </p>
            </div>
          </div>

          <Button
            onClick={handleCreateAdmin}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating admin user...
              </>
            ) : (
              "Create Admin User"
            )}
          </Button>

          {result && (
            <div
              className={`p-4 rounded-lg ${
                result.success
                  ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      result.success
                        ? "text-green-900 dark:text-green-100"
                        : "text-red-900 dark:text-red-100"
                    }`}
                  >
                    {result.success
                      ? "Admin user created successfully!"
                      : "Failed to create admin user"}
                  </p>
                  {result.error && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {result.error}
                    </p>
                  )}
                  {result.success && result.data && (
                    <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                      <p>Email: {result.data.email}</p>
                      <p>Role: {result.data.role}</p>
                      <p className="mt-2 font-medium">
                        You can now login at{" "}
                        <a href="/login" className="underline">
                          /login
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Make sure you have set the{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                SUPABASE_SECRET_KEY
              </code>{" "}
              environment variable in your <code>.env</code> file.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

