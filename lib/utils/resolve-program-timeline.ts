import { DEFAULT_PROGRAM_TIMELINE_STEPS } from "@/lib/constants/program-timeline-defaults";
import type { ProgramTimelineStep } from "@/lib/types/program-timeline";

function isStep(x: unknown): x is ProgramTimelineStep {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  if (!title || !description) return false;
  if (o.label !== undefined && o.label !== null && typeof o.label !== "string") return false;
  return true;
}

/**
 * Resolves the 5 steps to show on the product page.
 * - `null` / missing in DB → site default (always complete).
 * - Custom array → only if exactly 5 valid steps (title + description); otherwise `null` (hide section).
 */
export function resolveProgramTimelineSteps(raw: unknown): ProgramTimelineStep[] | null {
  if (raw === null || raw === undefined) {
    return DEFAULT_PROGRAM_TIMELINE_STEPS;
  }

  if (!Array.isArray(raw) || raw.length !== 5) {
    return null;
  }

  const steps: ProgramTimelineStep[] = [];
  for (const item of raw) {
    if (!isStep(item)) return null;
    steps.push({
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : undefined,
      title: (item.title as string).trim(),
      description: (item.description as string).trim(),
    });
  }

  return steps;
}
