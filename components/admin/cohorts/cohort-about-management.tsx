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
          <CardTitle>Description courte</CardTitle>
          <CardDescription>
            Cette description apparaîtra dans la section héro de la page de la cohorte (2-3 phrases)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="shortDescription">Description courte</Label>
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
          <CardTitle>Section À propos</CardTitle>
          <CardDescription>
            Texte riche détaillant la cohorte, ses objectifs, et ce que les participants peuvent attendre
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="aboutText">Texte À propos</Label>
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
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
