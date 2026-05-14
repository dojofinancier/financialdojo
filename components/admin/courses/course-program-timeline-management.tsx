"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCourseProgramTimelineAction } from "@/app/actions/courses";
import { DEFAULT_PROGRAM_TIMELINE_STEPS } from "@/lib/constants/program-timeline-defaults";
import type { ProgramTimelineStep } from "@/lib/types/program-timeline";

function cloneSteps(steps: ProgramTimelineStep[]): ProgramTimelineStep[] {
  return steps.map((s) => ({
    label: s.label,
    title: s.title,
    description: s.description,
  }));
}

interface CourseProgramTimelineManagementProps {
  courseId: string;
  initialProgramTimelineSteps: unknown;
}

export function CourseProgramTimelineManagement({
  courseId,
  initialProgramTimelineSteps,
}: CourseProgramTimelineManagementProps) {
  const initialUseDefault =
    initialProgramTimelineSteps === null || initialProgramTimelineSteps === undefined;

  const [useDefault, setUseDefault] = useState(initialUseDefault);
  const [steps, setSteps] = useState<ProgramTimelineStep[]>(() => {
    if (Array.isArray(initialProgramTimelineSteps) && initialProgramTimelineSteps.length === 5) {
      return cloneSteps(initialProgramTimelineSteps as ProgramTimelineStep[]);
    }
    return cloneSteps(DEFAULT_PROGRAM_TIMELINE_STEPS);
  });
  const [saving, setSaving] = useState(false);

  const updateStep = (index: number, patch: Partial<ProgramTimelineStep>) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseProgramTimelineAction(courseId, {
        programTimelineSteps: useDefault ? null : steps,
      });
      if (result.success) {
        toast.success("Program timeline updated");
      } else {
        toast.error(result.error || "Could not save");
      }
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Program timeline</CardTitle>
        <CardDescription>
          Controls the five-step section on the public course page. By default, every course uses the
          site-wide template. Turn off “Use site default” to save custom copy for this course only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="use-default-timeline">Use site default template</Label>
            <p className="text-sm text-muted-foreground">
              When on, the fields below are for reference only; the live page uses the central defaults.
            </p>
          </div>
          <Switch
            id="use-default-timeline"
            checked={useDefault}
            onCheckedChange={(checked) => {
              setUseDefault(checked);
              if (checked) {
                setSteps(cloneSteps(DEFAULT_PROGRAM_TIMELINE_STEPS));
              }
            }}
          />
        </div>

        <div className="space-y-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border p-4 bg-muted/30"
            >
              <div className="font-mono text-xs text-muted-foreground">Step {index + 1} of 5</div>
              <div className="grid gap-2">
                <Label htmlFor={`timeline-label-${index}`}>Time label (optional)</Label>
                <Input
                  id={`timeline-label-${index}`}
                  value={step.label ?? ""}
                  disabled={useDefault}
                  placeholder="e.g. Weeks 1–6"
                  onChange={(e) => updateStep(index, { label: e.target.value || undefined })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`timeline-title-${index}`}>Title</Label>
                <Input
                  id={`timeline-title-${index}`}
                  value={step.title}
                  disabled={useDefault}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`timeline-desc-${index}`}>Short description</Label>
                <Textarea
                  id={`timeline-desc-${index}`}
                  value={step.description}
                  disabled={useDefault}
                  rows={3}
                  onChange={(e) => updateStep(index, { description: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <Button type="button" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
