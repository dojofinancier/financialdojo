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
import { updateCourseFeaturesAction } from "@/app/actions/courses";

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

interface CourseFeaturesManagementProps {
  courseId: string;
  initialFeatures: Feature[];
}

export function CourseFeaturesManagement({ courseId, initialFeatures }: CourseFeaturesManagementProps) {
  const [features, setFeatures] = useState<Feature[]>(initialFeatures || []);
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState({ icon: "CheckCircle", text: "" });

  const IconComponent = ({ name }: { name: string }) => {
    const Icon = (LucideIcons as any)[name];
    return Icon ? <Icon className="h-5 w-5" /> : null;
  };

  const handleAddFeature = () => {
    if (!newFeature.text.trim()) {
      toast.error("Please enter the feature text");
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
      const result = await updateCourseFeaturesAction(courseId, features);
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
    <Card>
      <CardHeader>
        <CardTitle>Fonctionnalités du cours</CardTitle>
        <CardDescription>
          Ajoutez les fonctionnalités clés qui seront affichées sur la page du cours (8 max recommandé)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Feature Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid gap-4 md:grid-cols-[150px_1fr_auto]">
            <div className="space-y-2">
              <Label>Icône</Label>
              <Select
                value={newFeature.icon}
                onValueChange={(value) => setNewFeature({ ...newFeature, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <IconComponent name={newFeature.icon} />
                      <span className="text-xs">{newFeature.icon}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
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
              <Label>Texte de la fonctionnalité</Label>
              <Input
                value={newFeature.text}
                onChange={(e) => setNewFeature({ ...newFeature, text: e.target.value })}
                placeholder="Ex: 12 modules complets"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddFeature} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="space-y-3">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune fonctionnalité ajoutée. Ajoutez-en une ci-dessus.
            </p>
          ) : (
            features.map((feature, index) => (
              <div
                key={feature.id}
                className="flex items-center gap-4 p-3 border rounded-lg bg-background"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <IconComponent name={feature.icon} />
                  </div>
                  <span className="font-medium">{feature.text}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFeature(feature.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Save features"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}













