"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createFlashcardAction,
  deleteFlashcardAction,
  getFlashcardsAction,
  updateFlashcardAction,
} from "@/app/actions/flashcards";
import { getModulesAction } from "@/app/actions/modules";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Flashcard } from "@prisma/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { CSVUploadDialog } from "./csv-upload-dialog";

interface FlashcardManagerProps {
  courseId: string;
}

export function FlashcardManager({ courseId }: FlashcardManagerProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [formState, setFormState] = useState({ front: "", back: "", moduleId: "" as string | null });

  const loadFlashcards = async () => {
    setLoading(true);
    try {
      const result = await getFlashcardsAction(courseId);
      if (result.success && result.data) {
        // Ensure moduleId is properly handled (can be null/undefined)
        const flashcardsWithModule = (result.data as Array<Flashcard & { moduleId?: string | null; module?: { id: string; title: string } | null }>).map((card) => ({
          ...card,
          moduleId: card.moduleId ?? null,
        }));
        setFlashcards(flashcardsWithModule);
      } else {
        console.error("Flashcard loading error:", result.error);
        setFlashcards([]);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.error("Error loading flashcards");
        }
      }
    } catch (error) {
      console.error("Flashcard loading exception:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Erreur lors du chargement des flashcards: ${errorMessage}`);
      setFlashcards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlashcards();
    loadModules();
  }, [courseId]);

  const loadModules = async () => {
    try {
      const modulesData = await getModulesAction(courseId);
      setModules(modulesData.map((m: any) => ({ id: m.id, title: m.title })));
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  };

  const openCreateDialog = () => {
    setEditingCard(null);
    setFormState({ front: "", back: "", moduleId: null });
    setDialogOpen(true);
  };

  const openEditDialog = (card: Flashcard & { moduleId?: string | null }) => {
    setEditingCard(card);
    setFormState({ front: card.front, back: card.back, moduleId: card.moduleId || null });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formState.front.trim() || !formState.back.trim()) {
      toast.error("Le recto et le verso sont requis");
      return;
    }

    if (editingCard) {
      const result = await updateFlashcardAction(editingCard.id, {
        front: formState.front,
        back: formState.back,
        moduleId: formState.moduleId || null,
      });
      if (result.success) {
        toast.success("Flashcard updated");
        setDialogOpen(false);
        loadFlashcards();
      } else {
        toast.error(result.error || "Error updating");
      }
    } else {
      const result = await createFlashcardAction({
        courseId,
        front: formState.front,
        back: formState.back,
        moduleId: formState.moduleId || null,
      });
      if (result.success) {
        toast.success("Flashcard created");
        setDialogOpen(false);
        loadFlashcards();
      } else {
        toast.error(result.error || "Error creating");
      }
    }
  };

  const handleDelete = async (cardId: string) => {
    const result = await deleteFlashcardAction(cardId);
    if (result.success) {
      toast.success("Flashcard deleted");
      loadFlashcards();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Flashcards du cours</h2>
          <p className="text-sm text-muted-foreground">
            Créez des cartes recto-verso pour renforcer les notions clés du cours.
          </p>
        </div>
        <div className="flex gap-2">
          <CSVUploadDialog
            courseId={courseId}
            type="flashcard"
            onSuccess={() => loadFlashcards()}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle flashcard
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCard ? "Edit flashcard" : "Add a flashcard"}</DialogTitle>
              <DialogDescription>
                Définissez le recto (question) et le verso (réponse / explication).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Module (optionnel)</Label>
                <Select
                  value={formState.moduleId || "none"}
                  onValueChange={(value) => setFormState({ ...formState, moduleId: value === "none" ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun module</SelectItem>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recto</Label>
                <Textarea
                  value={formState.front}
                  onChange={(event) => setFormState({ ...formState, front: event.target.value })}
                  placeholder="Question, terme, notion..."
                />
              </div>
              <div className="space-y-2">
                <Label>Verso</Label>
                <Textarea
                  value={formState.back}
                  onChange={(event) => setFormState({ ...formState, back: event.target.value })}
                  placeholder="Answer, definition, explanation..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSubmit}>
                  {editingCard ? "Enregistrer" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des flashcards...
        </div>
      ) : flashcards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune flashcard pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {flashcards.map((card: Flashcard & { module?: { id: string; title: string } | null }) => (
            <Card key={card.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <CardTitle className="text-base">Recto</CardTitle>
                  {card.module && (
                    <p className="text-xs text-muted-foreground mt-1">Module: {card.module.title}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(card)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{card.front}</p>
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">Verso</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{card.back}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

