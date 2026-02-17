"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ConfirmResetPasswordClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Confirm we have a recovery session (set by /auth/callback exchanging the code)
  useEffect(() => {
    let retries = 0;
    const maxRetries = 2;

    const checkSession = async () => {
      try {
        const supabase = createClient();
        console.log("[ConfirmReset] Checking session...");
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[ConfirmReset] Session error:", error.message);
          setHasSession(false);
          setIsVerifying(false);
        } else if (data.session) {
          console.log("[ConfirmReset] Session found!");
          setHasSession(true);
          setIsVerifying(false);
        } else if (retries < maxRetries) {
          console.log(`[ConfirmReset] No session yet, retry ${retries + 1}...`);
          retries++;
          setTimeout(checkSession, 500); // Wait 500ms and try again
        } else {
          console.log("[ConfirmReset] No session found after retries.");
          setHasSession(false);
          setIsVerifying(false);
        }
      } catch (err) {
        console.error("[ConfirmReset] Unexpected error:", err);
        setHasSession(false);
        setIsVerifying(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must contain at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePasswordAction(password);

      if (result.success) {
        toast.success("Password updated successfully!");
        router.push("/login");
      } else {
        toast.error(result.error || "Error updating password");
        // If server says session missing, send user back to request a fresh link.
        if ((result.error || "").toLowerCase().includes("session")) {
          router.push("/reset-password");
        }
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Verifying session...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Invalid link</CardTitle>
            <CardDescription>
              The reset session is missing or expired. Please request a new link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/reset-password")}>
              Request a new link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">New password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
