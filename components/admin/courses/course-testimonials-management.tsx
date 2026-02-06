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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, GripVertical, X, Save, Quote } from "lucide-react";
import { updateCourseTestimonialsAction } from "@/app/actions/courses";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar?: string;
}

interface CourseTestimonialsManagementProps {
  courseId: string;
  initialTestimonials: Testimonial[];
}

export function CourseTestimonialsManagement({ courseId, initialTestimonials }: CourseTestimonialsManagementProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials || []);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    text: "",
  });

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.text.trim()) {
      toast.error("Veuillez remplir le nom et le témoignage");
      return;
    }

    const testimonial: Testimonial = {
      id: crypto.randomUUID(),
      name: formData.name,
      role: formData.role,
      text: formData.text,
    };

    setTestimonials([...testimonials, testimonial]);
    setFormData({ name: "", role: "", text: "" });
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name.trim() || !formData.text.trim()) {
      toast.error("Veuillez remplir le nom et le témoignage");
      return;
    }

    setTestimonials(testimonials.map((t) =>
      t.id === editingId
        ? { ...t, name: formData.name, role: formData.role, text: formData.text }
        : t
    ));
    setEditingId(null);
    setFormData({ name: "", role: "", text: "" });
  };

  const handleRemove = (id: string) => {
    setTestimonials(testimonials.filter((t) => t.id !== id));
  };

  const startEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id);
    setFormData({
      name: testimonial.name,
      role: testimonial.role,
      text: testimonial.text,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: "", role: "", text: "" });
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
    const oldIndex = testimonials.findIndex((t) => t.id === active.id);
    const newIndex = testimonials.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setTestimonials(arrayMove(testimonials, oldIndex, newIndex));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseTestimonialsAction(courseId, testimonials);
      if (result.success) {
        toast.success("Témoignages mis à jour avec succès");
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Témoignages</CardTitle>
        <CardDescription>
          Ajoutez les témoignages d'anciens étudiants (8 recommandé pour le carrousel)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add/Edit Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Marie Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle / Titre</Label>
              <Input
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Ex: Analyste financier"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Témoignage *</Label>
            <Textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Ex: Cette formation m'a permis de réussir mon examen du premier coup..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            {editingId ? (
              <>
                <Button onClick={handleUpdate} size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Mettre à jour
                </Button>
                <Button onClick={cancelEdit} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              </>
            ) : (
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un témoignage
              </Button>
            )}
          </div>
        </div>

        {/* Testimonials List */}
        <div className="space-y-3">
          {testimonials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun témoignage ajouté. Ajoutez-en un ci-dessus.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={testimonials.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {testimonials.map((testimonial) => (
                  <SortableTestimonialItem
                    key={testimonial.id}
                    testimonial={testimonial}
                    getInitials={getInitials}
                    startEdit={startEdit}
                    handleRemove={handleRemove}
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
            {saving ? "Enregistrement..." : "Enregistrer les témoignages"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableTestimonialItem({
  testimonial,
  getInitials,
  startEdit,
  handleRemove,
}: {
  testimonial: Testimonial;
  getInitials: (name: string) => string;
  startEdit: (t: Testimonial) => void;
  handleRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: testimonial.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(testimonial.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{testimonial.name}</h4>
                {testimonial.role && (
                  <span className="text-sm text-muted-foreground">
                    • {testimonial.role}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2 mt-2">
                <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground italic">
                  {testimonial.text}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEdit(testimonial)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(testimonial.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
