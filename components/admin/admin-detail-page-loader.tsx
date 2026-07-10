"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageLoading } from "@/components/admin/admin-page-loading";

export interface AdminDetailPageLoaderActions {
  /** Reload entity data from the server (e.g. after a tab save). */
  refetch: () => Promise<void>;
}

interface AdminDetailPageLoaderProps<T> {
  /** Stable key (e.g. entity id) — used as the effect dependency instead of `load`. */
  cacheKey: string;
  load: () => Promise<T | null>;
  children: (data: T, actions?: AdminDetailPageLoaderActions) => React.ReactNode;
}

/**
 * Loads admin detail data client-side after first paint so the initial
 * page GET stays fast on Netlify (avoids bundling SSR + DB work in one request).
 */
export function AdminDetailPageLoader<T>({
  cacheKey,
  load,
  children,
}: AdminDetailPageLoaderProps<T>) {
  const router = useRouter();
  const [data, setData] = useState<T | null | undefined>(undefined);

  const refetch = useCallback(async () => {
    const result = await load();
    if (result === null) {
      router.replace("/tableau-de-bord/admin");
      return;
    }
    setData(result);
  }, [load, router]);

  useEffect(() => {
    let cancelled = false;

    load().then((result) => {
      if (cancelled) return;
      if (result === null) {
        router.replace("/dashboard/admin");
        return;
      }
      setData(result);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, load, router]);

  if (data === undefined) {
    return <AdminPageLoading />;
  }

  if (data === null) {
    return null;
  }

  return <>{children(data, { refetch })}</>;
}
