"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, GripVertical, X, Save, Quote } from "lucide-react";
import { updateCohortTestimonialsAction } from "@/app/actions/cohorts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar?: string;
}

interface CohortTestimonialsManagementProps {
  cohortId: string;
  initialTestimonials: Testimonial[];
}

export function CohortTestimonialsManagement({ cohortId, initialTestimonials }: CohortTestimonialsManagementProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials || []);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    text: "",
    avatar: "",
  });

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.text.trim()) {
      toast.error("Please fill in the name and testimonial");
      return;
    }

    const testimonial: Testimonial = {
      id: crypto.randomUUID(),
      name: formData.name,
      role: formData.role,
      text: formData.text,
      avatar: formData.avatar || undefined,
    };

    setTestimonials([...testimonials, testimonial]);
    setFormData({ name: "", role: "", text: "", avatar: "" });
  };

  const handleEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id);
    setFormData({
      name: testimonial.name,
      role: testimonial.role,
      text: testimonial.text,
      avatar: testimonial.avatar || "",
    });
  };

  const handleUpdate = () => {
    if (!formData.name.trim() || !formData.text.trim()) {
      toast.error("Please fill in the name and testimonial");
      return;
    }

    setTestimonials(
      testimonials.map((t) =>
        t.id === editingId
          ? {
              ...t,
              name: formData.name,
              role: formData.role,
              text: formData.text,
              avatar: formData.avatar || undefined,
            }
          : t
      )
    );
    setEditingId(null);
    setFormData({ name: "", role: "", text: "", avatar: "" });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: "", role: "", text: "", avatar: "" });
  };

  const handleRemove = (id: string) => {
    setTestimonials(testimonials.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCohortTestimonialsAction(cohortId, testimonials);
      if (result.success) {
        toast.success("Testimonials updated successfully");
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error saving");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Témoignages</CardTitle>
          <CardDescription>
            Témoignages des participants à afficher dans la section dédiée de la page de la cohorte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Existing testimonials */}
            {testimonials.length > 0 && (
              <div className="space-y-3">
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="flex items-start gap-3 p-4 border rounded-lg"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {testimonial.avatar ? (
                          <img src={testimonial.avatar} alt={testimonial.name} />
                        ) : (
                          getInitials(testimonial.name)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{testimonial.name}</div>
                      {testimonial.role && (
                        <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      )}
                      <div className="mt-2 text-sm">{testimonial.text}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(testimonial)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(testimonial.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit form */}
            <div className="border-t pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="testimonialName">Nom *</Label>
                  <Input
                    id="testimonialName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testimonialRole">Rôle</Label>
                  <Input
                    id="testimonialRole"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Ex: Analyste financier"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonialText">Témoignage *</Label>
                <Textarea
                  id="testimonialText"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="Ex: This cohort helped me reach my goals..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonialAvatar">URL de l'avatar (optionnel)</Label>
                <Input
                  id="testimonialAvatar"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2">
                {editingId ? (
                  <>
                    <Button onClick={handleUpdate} variant="default">
                      Mettre à jour
                    </Button>
                    <Button onClick={handleCancel} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleAdd} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un témoignage
                  </Button>
                )}
              </div>
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
