import type { ProgramTimelineStep } from "@/lib/types/program-timeline";

/** Site-wide default timeline when `Course.programTimelineSteps` is null */
export const DEFAULT_PROGRAM_TIMELINE_STEPS: ProgramTimelineStep[] = [
  {
    label: "Day 1",
    title: "Assess your starting point",
    description:
      "Evaluate your level, constraints, and exam date so we can build a realistic study plan.",
  },
  {
    label: "Weeks 1–6",
    title: "Structured learning",
    description:
      "Work through modules and structured notes to master key concepts without getting lost in the material.",
  },
  {
    label: "Ongoing",
    title: "Strengthen retention",
    description:
      "Use flashcards and quizzes to lock in what matters and shore up weak areas.",
  },
  {
    label: "2 weeks before the exam",
    title: "Switch to exam mode",
    description:
      "Timed practice runs so you get used to format, pacing, and managing stress.",
  },
  {
    label: "Exam day",
    title: "Show up ready",
    description:
      "Follow evidence-based guidance drawn from 15 years of experience to perform at your best.",
  },
];
