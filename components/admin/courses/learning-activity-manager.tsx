"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createLearningActivityAction,
  deleteLearningActivityAction,
  getLearningActivitiesAction,
  updateLearningActivityAction,
  bulkDeleteLearningActivitiesAction,
} from "@/app/actions/learning-activities";
import { getModulesAction } from "@/app/actions/modules";
import { createContentItemAction } from "@/app/actions/content-items";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadLearningActivitiesCSVAction } from "@/app/actions/learning-activities-csv";

interface LearningActivityManagerProps {
  courseId: string;
}

type LearningActivityType =
  | "SHORT_ANSWER"
  | "FILL_IN_BLANK"
  | "SORTING_RANKING"
  | "CLASSIFICATION"
  | "NUMERIC_ENTRY"
  | "TABLE_COMPLETION"
  | "ERROR_SPOTTING"
  | "DEEP_DIVE";

type LearningActivity = {
  id: string;
  moduleId: string | null;
  activityType: LearningActivityType;
  title: string;
  instructions: string | null;
  content: any;
  correctAnswers: any;
  tolerance: number | null;
  module?: { id: string; title: string } | null;
  contentItem?: {
    id: string;
    module: { id: string; title: string };
  };
};

const ACTIVITY_TYPE_LABELS: Record<LearningActivityType, string> = {
  SHORT_ANSWER: "Short answer",
  FILL_IN_BLANK: "Fill-in-the-blank",
  SORTING_RANKING: "Tri / Classement",
  CLASSIFICATION: "Classification",
  NUMERIC_ENTRY: "Numeric calculation",
  TABLE_COMPLETION: "Table to complete",
  ERROR_SPOTTING: "Error detection",
  DEEP_DIVE: "Approfondissement",
};

export function LearningActivityManager({ courseId }: LearningActivityManagerProps) {
  const isMountedRef = useRef(true);
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LearningActivity | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [formState, setFormState] = useState({
    activityType: "SHORT_ANSWER" as LearningActivityType,
    instructions: "",
    moduleId: "" as string | null,
    // Activity-specific fields
    content: {} as any,
    correctAnswers: null as any,
    tolerance: null as number | null,
  });

  const loadActivities = async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const result = await getLearningActivitiesAction(courseId);
      if (!isMountedRef.current) return;
      if (result.success && result.data) {
        setActivities(result.data);
      } else {
        console.error("Learning activity loading error:", result.error);
        setActivities([]);
        if (result.error) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Learning activity loading exception:", error);
      toast.error("Error loading activities");
      setActivities([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadActivities();
    loadModules();
    
    return () => {
      isMountedRef.current = false;
    };
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
    setEditingActivity(null);
    setFormState({
      activityType: "SHORT_ANSWER",
      instructions: "",
      moduleId: null,
      content: {},
      correctAnswers: null,
      tolerance: null,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (activity: LearningActivity) => {
    setEditingActivity(activity);
    setFormState({
      activityType: activity.activityType,
      instructions: activity.instructions || "",
      moduleId: activity.moduleId || null,
      content: activity.content || {},
      correctAnswers: activity.correctAnswers || null,
      tolerance: activity.tolerance || null,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!formState.moduleId) {
        toast.error("Un module est requis");
        return;
      }

      // Validate activity-specific content
      if (formState.activityType === "SHORT_ANSWER") {
        if (!formState.content.question || !formState.content.question.trim()) {
          toast.error("The question is required for a short answer");
          return;
        }
        if (!formState.correctAnswers || (Array.isArray(formState.correctAnswers) && formState.correctAnswers.length === 0)) {
          toast.error("At least one acceptable answer is required");
          return;
        }
      }

      let contentItemId: string | null = null;

      // Create content item if it doesn't exist
      if (!editingActivity) {
        // Use order 0 - the action will automatically find the next available order if 0 is taken
        const contentItemResult = await createContentItemAction({
          moduleId: formState.moduleId,
          contentType: "LEARNING_ACTIVITY",
          order: 0,
          studyPhase: "PHASE_2_REVIEW",
        });

      if (!contentItemResult.success || !contentItemResult.data) {
        console.error("ContentItem creation error:", contentItemResult.error);
        console.error("Full result:", contentItemResult);
        toast.error(contentItemResult.error || "Error creating the content item");
        return;
      }

        contentItemId = contentItemResult.data.id;
      } else {
        contentItemId = editingActivity.contentItem?.id || null;
      }

      if (!contentItemId) {
        toast.error("Unable to create or find the content item");
        return;
      }

      // Prepare data - ensure correctAnswers is properly formatted
      let correctAnswersData = formState.correctAnswers;
      if (Array.isArray(correctAnswersData) && correctAnswersData.length === 0) {
        correctAnswersData = null;
      } else if (typeof correctAnswersData === "string" && correctAnswersData.trim() === "") {
        correctAnswersData = null;
      }

      // Generate a default title from activity type if needed
      const defaultTitle = ACTIVITY_TYPE_LABELS[formState.activityType] || "Activity";

      const result = editingActivity
        ? await updateLearningActivityAction(editingActivity.id, {
            moduleId: formState.moduleId,
            activityType: formState.activityType,
            title: defaultTitle,
            instructions: formState.instructions || null,
            content: formState.content,
            correctAnswers: correctAnswersData,
            tolerance: formState.tolerance,
          })
        : await createLearningActivityAction({
            moduleId: formState.moduleId,
            activityType: formState.activityType,
            title: defaultTitle,
            instructions: formState.instructions || null,
            content: formState.content,
            correctAnswers: correctAnswersData,
            tolerance: formState.tolerance,
            contentItemId: contentItemId,
          });

      if (result.success) {
        toast.success(editingActivity ? "Activity updated" : "Activity created");
        setDialogOpen(false);
        loadActivities();
      } else {
        console.error("Learning activity action error:", result.error);
        toast.error(result.error || "Error saving");
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Erreur: ${errorMessage}`);
    }
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) {
      return;
    }

    const result = await deleteLearningActivityAction(activityId);
    if (result.success) {
      toast.success("Activity deleted");
      loadActivities();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedActivities.size === 0) {
      toast.error("No activity selected");
      return;
    }

    const count = selectedActivities.size;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} activité${count > 1 ? "s" : ""}?`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const result = await bulkDeleteLearningActivitiesAction(Array.from(selectedActivities));
      if (result.success) {
        toast.success(`${result.deletedCount || count} activité${(result.deletedCount || count) > 1 ? "s" : ""} supprimée${(result.deletedCount || count) > 1 ? "s" : ""}`);
        setSelectedActivities(new Set());
        loadActivities();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error while deleting");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectActivity = (activityId: string) => {
    const newSelected = new Set(selectedActivities);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedActivities(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedActivities.size === activities.length) {
      setSelectedActivities(new Set());
    } else {
      setSelectedActivities(new Set(activities.map((a) => a.id)));
    }
  };

  const renderActivityForm = () => {
    switch (formState.activityType) {
      case "SHORT_ANSWER":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                value={formState.content.question || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, question: e.target.value },
                  })
                }
                placeholder="Ex: What is the formula for the future value of an ordinary annuity?"
              />
            </div>
            <div className="space-y-2">
              <Label>Réponses acceptables (une par ligne)</Label>
              <Textarea
                value={
                  Array.isArray(formState.correctAnswers)
                    ? formState.correctAnswers.join("\n")
                    : formState.correctAnswers || ""
                }
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    correctAnswers: e.target.value.split("\n").filter((a) => a.trim()),
                  })
                }
                placeholder="FV = PMT × [(1 + r)^n - 1] / r"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Entrez 2-3 réponses acceptables. La casse et les accents seront normalisés.
              </p>
            </div>
          </div>
        );

      case "FILL_IN_BLANK":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texte avec trous (utilisez ___ pour les blancs)</Label>
              <Textarea
                value={formState.content.text || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, text: e.target.value },
                  })
                }
                placeholder="The guarantee on a segregated fund is usually ___% at maturity if held for the full term."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Réponses correctes (une par trou, dans l'ordre)</Label>
              <Textarea
                value={
                  Array.isArray(formState.correctAnswers)
                    ? formState.correctAnswers.join("\n")
                    : formState.correctAnswers || ""
                }
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    correctAnswers: e.target.value.split("\n").filter((a) => a.trim()),
                  })
                }
                placeholder="75"
                rows={3}
              />
            </div>
          </div>
        );

      case "SORTING_RANKING":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formState.content.instructions || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, instructions: e.target.value },
                  })
                }
                placeholder="Order investment products from lowest to highest expected volatility."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Éléments à trier (un par ligne, dans l'ordre correct)</Label>
              <Textarea
                value={
                  Array.isArray(formState.content.items)
                    ? formState.content.items.join("\n")
                    : ""
                }
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: {
                      ...formState.content,
                      items: e.target.value.split("\n").filter((i) => i.trim()),
                    },
                  })
                }
                placeholder="GIC\nBond fund\nEquity fund\nOptions"
                rows={6}
              />
            </div>
          </div>
        );

      case "CLASSIFICATION":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formState.content.instructions || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, instructions: e.target.value },
                  })
                }
                placeholder="Sort the following into: Registered / Non-registered"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégories (une par ligne)</Label>
              <Textarea
                value={
                  Array.isArray(formState.content.categories)
                    ? formState.content.categories.join("\n")
                    : ""
                }
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: {
                      ...formState.content,
                      categories: e.target.value.split("\n").filter((c) => c.trim()),
                    },
                  })
                }
                placeholder="Registered\nNon-registered"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Éléments à classer (format: élément|catégorie, un par ligne)</Label>
              <Textarea
                key={`classification-items-${formState.activityType}`}
                value={
                  (() => {
                    // If we have a raw text value stored, use it (for editing)
                    if (formState.content._rawItemsText !== undefined) {
                      return formState.content._rawItemsText;
                    }
                    // Otherwise, reconstruct from items object
                    const items = formState.content.items;
                    if (!items || typeof items !== 'object' || Array.isArray(items)) {
                      return "";
                    }
                    const entries = Object.entries(items);
                    return entries.length > 0
                      ? entries.map(([item, category]) => `${item}|${category}`).join("\n")
                      : "";
                  })()
                }
                onChange={(e) => {
                  const newValue = e.target.value;
                  
                  // Store the raw text value for editing
                  setFormState((prev) => ({
                    ...prev,
                    content: { 
                      ...prev.content, 
                      _rawItemsText: newValue
                    },
                  }));
                  
                  // Parse into items object in the background (for validation/submission)
                  const items: Record<string, string> = {};
                  const lines = newValue.split("\n");
                  
                  lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                      const parts = trimmedLine.split("|").map((s) => s.trim());
                      if (parts.length >= 2 && parts[0] && parts[1]) {
                        items[parts[0]] = parts[1];
                      }
                    }
                  });
                  
                  // Update items object (but keep raw text for display)
                  setFormState((prev) => ({
                    ...prev,
                    content: { 
                      ...prev.content, 
                      items: items,
                      _rawItemsText: newValue
                    },
                  }));
                }}
                onBlur={(e) => {
                  // On blur, parse and clean up the value, remove _rawItemsText
                  const newValue = e.target.value;
                  const items: Record<string, string> = {};
                  const lines = newValue.split("\n");
                  
                  lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                      const parts = trimmedLine.split("|").map((s) => s.trim());
                      if (parts.length >= 2 && parts[0] && parts[1]) {
                        items[parts[0]] = parts[1];
                      }
                    }
                  });
                  
                  // Remove _rawItemsText and keep only parsed items
                  setFormState((prev) => {
                    const { _rawItemsText, ...contentWithoutRaw } = prev.content;
                    return {
                      ...prev,
                      content: { 
                        ...contentWithoutRaw,
                        items: items
                      },
                    };
                  });
                }}
                placeholder="RRSP|Registered&#10;TFSA|Registered&#10;Margin account|Non-registered"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Format: chaque ligne doit contenir "élément|catégorie". Exemple: RRSP|Registered
              </p>
            </div>
          </div>
        );

      case "NUMERIC_ENTRY":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question / Problème</Label>
              <Textarea
                value={formState.content.question || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, question: e.target.value },
                  })
                }
                placeholder="Compute the value of this investment after 5 years..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Réponse correcte</Label>
                <Input
                  type="number"
                  step="any"
                  value={formState.correctAnswers || ""}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      correctAnswers: parseFloat(e.target.value) || null,
                    })
                  }
                  placeholder="1234.56"
                />
              </div>
              <div className="space-y-2">
                <Label>Tolérance (±)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formState.tolerance || ""}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      tolerance: parseFloat(e.target.value) || null,
                    })
                  }
                  placeholder="0.01 ou 1 (pour %)"
                />
                <p className="text-xs text-muted-foreground">
                  Tolérance absolue (ex: 0.01) ou relative en % (ex: 1)
                </p>
              </div>
            </div>
          </div>
        );

      case "TABLE_COMPLETION":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formState.content.instructions || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, instructions: e.target.value },
                  })
                }
                placeholder="Fill in the missing cells in the risk vs. return table."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Structure du tableau (JSON)</Label>
              <Textarea
                value={JSON.stringify(formState.content.table || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const table = JSON.parse(e.target.value);
                    setFormState({
                      ...formState,
                      content: { ...formState.content, table },
                    });
                  } catch {
                    // Invalid JSON, keep as is
                  }
                }}
                placeholder='{"headers": ["Product", "Risk", "Return"], "rows": [...]}'
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Format JSON avec headers et rows. Utilisez null pour les cellules à compléter.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Réponses correctes (JSON)</Label>
              <Textarea
                value={JSON.stringify(formState.correctAnswers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const answers = JSON.parse(e.target.value);
                    setFormState({
                      ...formState,
                      correctAnswers: answers,
                    });
                  } catch {
                    // Invalid JSON
                  }
                }}
                placeholder='{"rowIndex_cellIndex": "answer"}'
                rows={4}
              />
            </div>
          </div>
        );

      case "ERROR_SPOTTING":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Solution avec erreur</Label>
              <Textarea
                value={formState.content.incorrectSolution || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, incorrectSolution: e.target.value },
                  })
                }
                placeholder="Show the worked solution with 1-2 mistakes..."
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                value={formState.content.question || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, question: e.target.value },
                  })
                }
                placeholder="Identify the first mistake in this reasoning"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Réponse correcte (description de l'erreur)</Label>
              <Textarea
                value={formState.correctAnswers || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    correctAnswers: e.target.value,
                  })
                }
                placeholder="The rate and compounding period don't match..."
                rows={3}
              />
            </div>
          </div>
        );

      case "DEEP_DIVE":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sujet</Label>
              <Input
                value={formState.content.topic || ""}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: { ...formState.content, topic: e.target.value },
                  })
                }
                placeholder="Ex: Segregated Funds"
              />
            </div>
            <div className="space-y-2">
              <Label>Questions de recherche (une par ligne)</Label>
              <Textarea
                value={
                  Array.isArray(formState.content.questions)
                    ? formState.content.questions.join("\n")
                    : ""
                }
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    content: {
                      ...formState.content,
                      questions: e.target.value.split("\n").filter((q) => q.trim()),
                    },
                  })
                }
                placeholder="List the pros and cons of this product\nWhat is the history/evolution of this product in the last 20 years?\nWhat are real life examples of this?"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Ces activités ne seront pas notées automatiquement. L'instructeur les examinera et commentera.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Activités d'apprentissage</h2>
          <p className="text-sm text-muted-foreground">
            Créez des activités interactives pour la Phase 2 (Révision). Taggez-les par chapitre/module.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importer CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importer des activités depuis un CSV</DialogTitle>
                <DialogDescription>
                  Téléversez un fichier CSV contenant des activités d'apprentissage. 
                  Les templates sont disponibles dans le dossier templates/learning-activities/
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Fichier CSV</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !isMountedRef.current) return;

                      // Reset the input value to allow re-uploading the same file
                      e.target.value = "";

                      if (!isMountedRef.current) return;
                      setUploading(true);
                      try {
                        const text = await file.text();
                        const result = await uploadLearningActivitiesCSVAction(courseId, text);

                        if (!isMountedRef.current) return;

                        if (result.success) {
                          const created = result.data?.activitiesCreated || 0;
                          const errors = result.data?.errors || [];
                          
                          if (errors.length > 0) {
                            toast.warning(
                              `${created} activité(s) créée(s), mais ${errors.length} erreur(s) détectée(s)`
                            );
                            console.error("Erreurs d'upload:", errors);
                          } else {
                            toast.success(`${created} activité(s) importée(s) avec succès`);
                          }
                          
                          // Close dialog and reload activities
                          if (isMountedRef.current) {
                            setCsvDialogOpen(false);
                            // Use requestAnimationFrame to ensure state update is processed
                            requestAnimationFrame(() => {
                              if (isMountedRef.current) {
                                loadActivities();
                              }
                            });
                          }
                        } else {
                          toast.error(result.error || "Error during import");
                        }
                      } catch (error) {
                        console.error("Error uploading CSV:", error);
                        toast.error("Error reading the file");
                      } finally {
                        if (isMountedRef.current) {
                          setUploading(false);
                        }
                      }
                    }}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Import en cours...
                    </div>
                  )}
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-semibold mb-2">Formats CSV supportés:</p>
                  <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                    <li>SHORT_ANSWER: ActivityType, Module, Instructions, Question, CorrectAnswer1, CorrectAnswer2, CorrectAnswer3</li>
                    <li>FILL_IN_BLANK: ActivityType, Module, Instructions, Text, CorrectAnswer</li>
                    <li>SORTING_RANKING: ActivityType, Module, Instructions, Item1, Item2, Item3, ...</li>
                    <li>CLASSIFICATION: ActivityType, Module, Instructions, Category1, Category2, Item1|Category, ...</li>
                    <li>NUMERIC_ENTRY: ActivityType, Module, Instructions, Question, CorrectAnswer, Tolerance</li>
                    <li>TABLE_COMPLETION: ActivityType, Module, Instructions, TableJSON, AnswersJSON</li>
                    <li>ERROR_SPOTTING: ActivityType, Module, Instructions, IncorrectSolution, Question, CorrectAnswer</li>
                    <li>DEEP_DIVE: ActivityType, Module, Instructions, Topic, Question1, Question2, Question3</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle activité
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingActivity ? "Edit activity" : "Create a learning activity"}
              </DialogTitle>
              <DialogDescription>
                Choisissez le type d'activité et configurez-la selon vos besoins.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Type d'activité *</Label>
                <Select
                  value={formState.activityType}
                  onValueChange={(value) => {
                    const newActivityType = value as LearningActivityType;
                    // Initialize content based on activity type
                    let initialContent: any = {};
                    if (newActivityType === "CLASSIFICATION") {
                      initialContent = { items: {}, categories: [] };
                    } else if (newActivityType === "SORTING_RANKING") {
                      initialContent = { items: [] };
                    }
                    
                    setFormState({
                      ...formState,
                      activityType: newActivityType,
                      content: initialContent,
                      correctAnswers: null,
                      tolerance: null,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Module / Chapitre *</Label>
                <Select
                  value={formState.moduleId || ""}
                  onValueChange={(value) => setFormState({ ...formState, moduleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Instructions (optionnel)</Label>
                <Textarea
                  value={formState.instructions}
                  onChange={(e) => setFormState({ ...formState, instructions: e.target.value })}
                  placeholder="General instructions for the student..."
                  rows={2}
                />
              </div>

              <Tabs defaultValue="config" className="w-full">
                <TabsList>
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                </TabsList>
                <TabsContent value="config" className="space-y-4" key={formState.activityType}>
                  {renderActivityForm()}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSubmit}>
                  {editingActivity ? "Enregistrer" : "Create"}
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
          Chargement des activités...
        </div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune activité d'apprentissage pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {selectedActivities.size > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedActivities.size} activité{selectedActivities.size > 1 ? "s" : ""} sélectionnée{selectedActivities.size > 1 ? "s" : ""}
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer la sélection
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4">
            {activities.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedActivities.size === activities.length && activities.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      {selectedActivities.size === activities.length ? "Deselect all" : "Select all"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
            {activities.map((activity) => (
              <Card key={activity.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedActivities.has(activity.id)}
                      onCheckedChange={() => toggleSelectActivity(activity.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{activity.title}</CardTitle>
                        <Badge variant="secondary">
                          {ACTIVITY_TYPE_LABELS[activity.activityType]}
                        </Badge>
                      </div>
                      {activity.module && (
                        <p className="text-sm text-muted-foreground">
                          Module: {activity.module.title}
                        </p>
                      )}
                      {activity.instructions && (
                        <p className="text-sm text-muted-foreground mt-2">{activity.instructions}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(activity)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(activity.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

