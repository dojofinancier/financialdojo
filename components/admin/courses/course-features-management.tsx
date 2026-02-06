"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { updateCourseFeaturesAction } from "@/app/actions/courses";
import { FEATURE_ICONS } from "@/lib/constants/feature-icons";

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
      toast.error("Veuillez entrer le texte de la fonctionnalité");
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = features.findIndex((f) => f.id === active.id);
    const newIndex = features.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setFeatures(arrayMove(features, oldIndex, newIndex));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseFeaturesAction(courseId, features);
      if (result.success) {
        toast.success("Fonctionnalités mises à jour avec succès");
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
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
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {FEATURE_ICONS.map((icon) => (
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={features.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {features.map((feature) => (
                  <SortableFeatureItem
                    key={feature.id}
                    feature={feature}
                    IconComponent={IconComponent}
                    onRemove={() => handleRemoveFeature(feature.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer les fonctionnalités"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableFeatureItem({
  feature,
  IconComponent,
  onRemove,
}: {
  feature: Feature;
  IconComponent: ({ name }: { name: string }) => React.ReactNode;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-3 border rounded-lg bg-background"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-3 flex-1">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <IconComponent name={feature.icon} />
        </div>
        <span className="font-medium">{feature.text}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
