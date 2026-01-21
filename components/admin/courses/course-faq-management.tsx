"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCourseFAQAction,
  updateCourseFAQAction,
  deleteCourseFAQAction,
  getCourseFAQsAction,
  reorderCourseFAQsAction,
} from "@/app/actions/course-faqs";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, GripVertical, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

interface CourseFAQManagementProps {
  courseId: string;
}

export function CourseFAQManagement({ courseId }: CourseFAQManagementProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ question: "", answer: "" });

  useEffect(() => {
    loadFAQs();
  }, [courseId]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const result = await getCourseFAQsAction(courseId);
      if (result.success && result.data) {
        setFaqs(result.data);
      }
    } catch (error) {
      console.error("Error loading FAQs:", error);
      toast.error("Error loading FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const result = await createCourseFAQAction(courseId, {
        question: formData.question,
        answer: formData.answer,
        order: faqs.length,
      });

      if (result.success) {
        toast.success("FAQ created successfully");
        setFormData({ question: "", answer: "" });
        loadFAQs();
      } else {
        toast.error(result.error || "Error creating");
      }
    } catch (error) {
      toast.error("Error creating the FAQ");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const result = await updateCourseFAQAction(id, {
        question: formData.question,
        answer: formData.answer,
      });

      if (result.success) {
        toast.success("FAQ updated successfully");
        setEditingId(null);
        setFormData({ question: "", answer: "" });
        loadFAQs();
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error updating the FAQ");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteCourseFAQAction(id);
      if (result.success) {
        toast.success("FAQ deleted successfully");
        loadFAQs();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error deleting the FAQ");
    } finally {
      setDeleteId(null);
    }
  };

  const startEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setFormData({ question: faq.question, answer: faq.answer });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ question: "", answer: "" });
  };

  if (loading) {
    return <div className="text-muted-foreground">Chargement des FAQ...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Questions fréquentes (FAQ)</CardTitle>
          <CardDescription>
            Ajoutez et gérez les questions fréquentes pour cette formation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New FAQ Form */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                placeholder="Eg: How long does the training last?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Réponse</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) =>
                  setFormData({ ...formData, answer: e.target.value })
                }
                placeholder="Eg: The training lasts 12 weeks with access for 1 year..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              {editingId ? (
                <>
                  <Button
                    onClick={() => handleUpdate(editingId)}
                    size="sm"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Mettre à jour
                  </Button>
                  <Button
                    onClick={cancelEdit}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une FAQ
                </Button>
              )}
            </div>
          </div>

          {/* FAQs List */}
          <div className="space-y-3">
            {faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune FAQ pour le moment. Ajoutez-en une ci-dessus.
              </p>
            ) : (
              faqs.map((faq) => (
                <Card key={faq.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <h4 className="font-semibold">{faq.question}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(faq)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(faq.id)}
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
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette FAQ ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

