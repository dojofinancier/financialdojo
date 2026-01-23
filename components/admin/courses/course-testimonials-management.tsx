"use client";

import { useState } from "react";
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
      toast.error("Please fill in the name and testimonial");
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
      toast.error("Please fill in the name and testimonial");
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseTestimonialsAction(courseId, testimonials);
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
    <Card>
      <CardHeader>
        <CardTitle>Testimonials</CardTitle>
        <CardDescription>
          Add testimonials from former students (8 recommended for the carousel)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add/Edit Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Marie Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Role / Title</Label>
              <Input
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g., Financial analyst"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Testimonial *</Label>
            <Textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="Ex: This course helped me pass my exam on the first try..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            {editingId ? (
              <>
                <Button onClick={handleUpdate} size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Update
                </Button>
                <Button onClick={cancelEdit} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add testimonial
              </Button>
            )}
          </div>
        </div>

        {/* Testimonials List */}
        <div className="space-y-3">
          {testimonials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No testimonials yet. Add one above.
            </p>
          ) : (
            testimonials.map((testimonial) => (
              <Card key={testimonial.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-move" />
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
            ))
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Enregistrement..." : "Save testimonials"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}













