"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, X, Save } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { updateCohortFeaturesAction } from "@/app/actions/cohorts";

// Available icons for features
const availableIcons = [
  "BookOpen", "Video", "FileText", "HelpCircle", "Award", "Clock",
  "Users", "CheckCircle", "Target", "Zap", "Shield", "Star",
  "Trophy", "GraduationCap", "Brain", "Lightbulb", "Rocket", "Heart",
  "MessageCircle", "Calendar", "BarChart", "Headphones", "Download", "Play"
] as const;

interface Feature {
  id: string;
  icon: string;
  text: string;
}

interface CohortFeaturesManagementProps {
  cohortId: string;
  initialFeatures: Feature[];
}

export function CohortFeaturesManagement({ cohortId, initialFeatures }: CohortFeaturesManagementProps) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures || []);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState({ icon: "CheckCircle", text: "" });

  const IconComponent = ({ name }: { name: string }) => {
    const Icon = (LucideIcons as any)[name];
    return Icon ? <Icon className="h-5 w-5" /> : null;
  };

  const handleAddFeature = () => {
    if (!newFeature.text.trim()) {
      toast.error("Please enter text for the feature");
      return;
    }

    const feature: Feature = {
      id: crypto.randomUUID(),
      icon: newFeature.icon,
      text: newFeature.text,
    };

    setFeatures([...features, feature]);
    setNewFeature({ icon: "CheckCircle", text: "" });
  };

  const handleRemoveFeature = (id: string) => {
    setFeatures(features.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCohortFeaturesAction(cohortId, features);
      if (result.success) {
        toast.success("Features updated successfully");
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
          <CardTitle>Fonctionnalités</CardTitle>
          <CardDescription>
            Liste des fonctionnalités à afficher dans la section héro de la page de la cohorte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Existing features */}
            {features.length > 0 && (
              <div className="space-y-2">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <IconComponent name={feature.icon} />
                    <span className="flex-1">{feature.text}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFeature(feature.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new feature */}
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="featureIcon">Icône</Label>
                  <Select
                    value={newFeature.icon}
                    onValueChange={(value) => setNewFeature({ ...newFeature, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIcons.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <IconComponent name={icon} />
                            <span>{icon}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="featureText">Texte</Label>
                  <Input
                    id="featureText"
                    value={newFeature.text}
                    onChange={(e) => setNewFeature({ ...newFeature, text: e.target.value })}
                    placeholder="Ex: Sessions de coaching en groupe"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                  />
                </div>
              </div>
              <Button onClick={handleAddFeature} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une fonctionnalité
              </Button>
            </div>
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
