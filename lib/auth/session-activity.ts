/**
 * Tracks the timestamp of the user's last successful Server Action call
 * on the client. Persisted to localStorage so that idle detection works
 * across component re-mounts and route changes within the same tab.
 */

const STORAGE_KEY = "dojo:last-action-success-at";

export function recordActivity(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // localStorage may be unavailable
  }
}

export function getLastActivityAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function getIdleMs(now: number = Date.now()): number {
  const last = getLastActivityAt();
  if (!last) return 0;
  return Math.max(0, now - last);
}
