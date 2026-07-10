"use client";

import { useSessionGuard } from "@/lib/auth/use-session-guard";

export function SessionGuard() {
  useSessionGuard();
  return null;
}
