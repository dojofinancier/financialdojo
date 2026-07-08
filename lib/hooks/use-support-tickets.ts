"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupportTicketsAction } from "@/app/actions/support-tickets";

export function useSupportTickets(params?: {
  cursor?: string;
  limit?: number;
  status?: string;
  priority?: string;
  category?: string;
  assignedAdminId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["support-tickets", params],
    queryFn: () => getSupportTicketsAction(params || {}),
    // Treat as immediately stale so mounting the Support tab always revalidates.
    // Without this, creating a ticket on another route and navigating back shows
    // a cached empty list until staleTime expires.
    staleTime: 0,
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for quick revisits
    refetchOnMount: "always",
  });
}
