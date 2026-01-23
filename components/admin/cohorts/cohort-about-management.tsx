"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "../courses/rich-text-editor";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCohortAboutAction } from "@/app/actions/cohorts";

interface CohortAboutManagementProps {
  cohortId: string;
  initialShortDescription: string;
  initialAboutText: string;
}

export function CohortAboutManagement({ 
  cohortId, 
  initialShortDescription,
  initialAboutText 
}: CohortAboutManagementProps) {
  const [shortDescription, setShortDescription] = useState(initialShortDescription || "");
  const [aboutText, setAboutText] = useState(initialAboutText || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCohortAboutAction(cohortId, { shortDescription, aboutText });
      if (result.success) {
        toast.success("Information updated successfully");
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error saving");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Short description</CardTitle>
          <CardDescription>
            This description will appear in the cohort page hero section (2-3 sentences)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short description</Label>
            <Input
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Ex: Intensive training with personalized support and group coaching sessions"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About section</CardTitle>
          <CardDescription>
            Rich text detailing the cohort, its goals, and what participants can expect
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="aboutText">About text</Label>
            <RichTextEditor
              content={aboutText}
              onChange={setAboutText}
              placeholder="Describe your cohort in detail..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
