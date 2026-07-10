"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { recordActivity } from "@/lib/auth/session-activity";

function getCurrentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export const SESSION_EXPIRED_TOAST_ID = "session-expired";

export function isAuthExpiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" && msg.toLowerCase().includes("unexpected response");
}

export async function callAction<T>(
  fn: () => Promise<T>,
  onAuthExpired: () => void,
): Promise<T | null> {
  try {
    const result = await fn();
    recordActivity();
    return result;
  } catch (err) {
    if (isAuthExpiredError(err)) {
      onAuthExpired();
      return null;
    }
    throw err;
  }
}

export function useCallAction() {
  const router = useRouter();

  return useCallback(
    <T,>(fn: () => Promise<T>): Promise<T | null> => {
      return callAction(fn, () => {
        toast.error("Your session has expired. Please sign in again.", {
          id: SESSION_EXPIRED_TOAST_ID,
        });
        const next = getCurrentPathname();
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      });
    },
    [router],
  );
}
