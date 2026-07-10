"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getIdleMs, recordActivity } from "./session-activity";
import { SESSION_EXPIRED_TOAST_ID } from "@/lib/actions/call-action";

function getCurrentPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

const DEFAULT_IDLE_THRESHOLD_MS = 30 * 60 * 1000;
const MIN_CHECK_INTERVAL_MS = 30 * 1000;

export interface UseSessionGuardOptions {
  idleThresholdMs?: number;
  watchVisibility?: boolean;
  checkOnMount?: boolean;
}

export function useSessionGuard(options: UseSessionGuardOptions = {}) {
  const {
    idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
    watchVisibility = true,
    checkOnMount = true,
  } = options;

  const router = useRouter();
  const lastCheckRef = useRef<number>(0);

  const redirectToLogin = useCallback(() => {
    toast.error("Your session has expired. Please sign in again.", {
      id: SESSION_EXPIRED_TOAST_ID,
    });
    const next = getCurrentPathname();
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  const checkSession = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL_MS) {
      return true;
    }
    lastCheckRef.current = now;

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        redirectToLogin();
        return false;
      }
      recordActivity(now);
      return true;
    } catch {
      return true;
    }
  }, [redirectToLogin]);

  const ensureFresh = useCallback(async (): Promise<boolean> => {
    if (getIdleMs() >= idleThresholdMs) {
      return checkSession();
    }
    return true;
  }, [checkSession, idleThresholdMs]);

  useEffect(() => {
    if (!checkOnMount) return;
    if (getIdleMs() >= idleThresholdMs) {
      void checkSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!watchVisibility) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };
    const onFocus = () => {
      void checkSession();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [watchVisibility, checkSession]);

  return { ensureFresh, checkSession };
}
