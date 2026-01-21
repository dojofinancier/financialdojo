"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getModulesAction,
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  reorderModulesAction,
} from "@/app/actions/modules";
import {
  createContentItemAction,
  deleteContentItemAction,
  reorderContentItemsAction,
  updateContentItemAction,
} from "@/app/actions/content-items";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Edit,
  Trash2,
  Video,
  FileQuestion,
  StickyNote,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Module, ContentItem, Video as VideoModel, Quiz, Note, QuizQuestion, ContentType } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "./rich-text-editor";
import { QuizBuilder } from "./quiz-builder";
import { FileUploadButton } from "./file-upload-button";
import { marked } from "marked";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type FullContentItem = ContentItem & {
  video?: VideoModel | null;
  quiz?: (Quiz & { questions: QuizQuestion[] }) | null;
  notes: Note[];
};

type ModuleWithContent = Module & {
  contentItems: FullContentItem[];
};

interface ModuleManagementProps {
  courseId: string;
}

export function ModuleManagement({ courseId }: ModuleManagementProps) {
  const [modules, setModules] = useState<ModuleWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleWithContent | null>(null);
  const [formData, setFormData] = useState({ title: "", shortTitle: "", description: "", examWeight: "" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadModules = async () => {
    try {
      setLoading(true);
      const data = await getModulesAction(courseId);
      setModules(data as ModuleWithContent[]);
    } catch (error) {
      toast.error("Error loading modules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [courseId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);

      const newModules = arrayMove(modules, oldIndex, newIndex);
      setModules(newModules);

      // Update orders
      const moduleOrders = newModules.map((module, index) => ({
        id: module.id,
        order: index,
      }));

      const result = await reorderModulesAction(courseId, moduleOrders);
      if (!result.success) {
        toast.error("Error reordering");
        loadModules(); // Reload on error
      }
    }
  };

  const handleCreate = async () => {
    try {
      const result = await createModuleAction({
        courseId,
        title: formData.title,
        shortTitle: formData.shortTitle || undefined,
        description: formData.description || undefined,
        order: modules.length,
        examWeight: formData.examWeight ? parseFloat(formData.examWeight) / 100 : undefined,
      });

      if (result.success) {
        toast.success("Module created successfully");
        setCreateDialogOpen(false);
        setFormData({ title: "", shortTitle: "", description: "", examWeight: "" });
        loadModules();
      } else {
        toast.error(result.error || "Error creating");
      }
    } catch (error) {
      toast.error("Error creating module");
    }
  };

  const handleUpdate = async () => {
    if (!selectedModule) return;

    try {
      const result = await updateModuleAction(selectedModule.id, {
        title: formData.title,
        shortTitle: formData.shortTitle || undefined,
        description: formData.description || undefined,
        examWeight: formData.examWeight ? parseFloat(formData.examWeight) / 100 : undefined,
      });

      if (result.success) {
        toast.success("Module updated successfully");
        setEditDialogOpen(false);
        setSelectedModule(null);
        setFormData({ title: "", shortTitle: "", description: "", examWeight: "" });
        loadModules();
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error updating module");
    }
  };

  const handleDelete = async () => {
    if (!selectedModule) return;

    try {
      const result = await deleteModuleAction(selectedModule.id);
      if (result.success) {
        toast.success("Module deleted successfully");
        setDeleteDialogOpen(false);
        setSelectedModule(null);
        loadModules();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error deleting module");
    }
  };

  const openEditDialog = (module: ModuleWithContent) => {
    setSelectedModule(module);
    setFormData({
      title: module.title,
      shortTitle: module.shortTitle || "",
      description: module.description || "",
      examWeight: module.examWeight ? (module.examWeight * 100).toString() : "",
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (module: ModuleWithContent) => {
    setSelectedModule(module);
    setDeleteDialogOpen(true);
  };

  const getContentIcon = (contentType: string) => {
    switch (contentType) {
      case "VIDEO":
        return <Video className="h-4 w-4" />;
      case "QUIZ":
        return <FileQuestion className="h-4 w-4" />;
      case "NOTE":
        return <StickyNote className="h-4 w-4" />;
      case "FLASHCARD":
        return <Layers className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Modules</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau module
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un module</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau module à ce cours
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Introduction"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortTitle">Titre court (pour la barre latérale)</Label>
                <Input
                  id="shortTitle"
                  value={formData.shortTitle}
                  onChange={(e) => setFormData({ ...formData, shortTitle: e.target.value })}
                  placeholder="Ex: Intro (optionnel)"
                />
                <p className="text-xs text-muted-foreground">
                  Optionnel. Un titre plus court qui s'affichera dans la barre latérale si le titre complet est trop long.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du module..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="examWeight">Pondération à l'examen (%)</Label>
                <Input
                  id="examWeight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.examWeight}
                  onChange={(e) => setFormData({ ...formData, examWeight: e.target.value })}
                  placeholder="Ex: 15 (pour 15%)"
                />
                <p className="text-xs text-muted-foreground">
                  Optionnel. Entrez un pourcentage (0-100) représentant le poids de ce module à l'examen.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate} disabled={!formData.title}>
                  Créer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {modules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun module. Créez votre premier module pour commencer.
                </CardContent>
              </Card>
            ) : (
              modules.map((module) => (
                <SortableModuleItem
                  key={module.id}
                  module={module}
                  onEdit={() => openEditDialog(module)}
                  onDelete={() => openDeleteDialog(module)}
                  getContentIcon={getContentIcon}
                  onRefresh={loadModules}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le module</DialogTitle>
            <DialogDescription>
              Modifiez les détails du module
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-shortTitle">Titre court (pour la barre latérale)</Label>
              <Input
                id="edit-shortTitle"
                value={formData.shortTitle}
                onChange={(e) => setFormData({ ...formData, shortTitle: e.target.value })}
                placeholder="Ex: Intro (optionnel)"
              />
              <p className="text-xs text-muted-foreground">
                Optionnel. Un titre plus court qui s'affichera dans la barre latérale si le titre complet est trop long.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-examWeight">Pondération à l'examen (%)</Label>
              <Input
                id="edit-examWeight"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.examWeight}
                onChange={(e) => setFormData({ ...formData, examWeight: e.target.value })}
                placeholder="Ex: 15 (pour 15%)"
              />
              <p className="text-xs text-muted-foreground">
                Optionnel. Entrez un pourcentage (0-100) représentant le poids de ce module à l'examen.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdate} disabled={!formData.title}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le module</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce module ? Tous les contenus associés seront également supprimés.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableModuleItemProps {
  module: ModuleWithContent;
  onEdit: () => void;
  onDelete: () => void;
  getContentIcon: (type: string) => React.ReactNode | null;
  onRefresh: () => void;
}

function SortableModuleItem({
  module,
  onEdit,
  onDelete,
  getContentIcon,
  onRefresh,
}: SortableModuleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing mt-1"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{module.title}</CardTitle>
              {module.description && (
                <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {module.contentItems
                  .filter((item) => {
                    // Only show Phase 1 content types: VIDEO, NOTE, and QUIZ (non-mock exams)
                    if (item.contentType === "VIDEO" || item.contentType === "NOTE") {
                      return true;
                    }
                    if (item.contentType === "QUIZ") {
                      // Only show non-mock exam quizzes
                      return item.quiz && !item.quiz.isMockExam;
                    }
                    return false;
                  })
                  .map((item) => (
                    <Badge key={item.id} variant="outline" className="gap-1">
                      {getContentIcon(item.contentType)}
                      {item.contentType}
                    </Badge>
                  ))}
                {module.contentItems.filter((item) => {
                  if (item.contentType === "VIDEO" || item.contentType === "NOTE") return true;
                  if (item.contentType === "QUIZ") return item.quiz && !item.quiz.isMockExam;
                  return false;
                }).length === 0 && (
                  <Badge variant="secondary">Aucun contenu</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ModuleContentManager module={module} courseId={module.courseId} onRefresh={onRefresh} />
      </CardContent>
    </Card>
  );
}

interface ModuleContentManagerProps {
  module: ModuleWithContent;
  courseId: string;
  onRefresh: () => void;
}

function ModuleContentManager({ module, courseId, onRefresh }: ModuleContentManagerProps) {
  // Filter to only show Phase 1 content: VIDEO, NOTE, and QUIZ (non-mock exams)
  const filteredContentItems = module.contentItems.filter((item) => {
    if (item.contentType === "VIDEO" || item.contentType === "NOTE") {
      return true;
    }
    if (item.contentType === "QUIZ") {
      // Only show non-mock exam quizzes
      return item.quiz && !item.quiz.isMockExam;
    }
    // Exclude FLASHCARD, LEARNING_ACTIVITY, and mock exams
    return false;
  });

  const [items, setItems] = useState<FullContentItem[]>(filteredContentItems);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentMode, setContentMode] = useState<"create" | "edit">("create");
  const [contentType, setContentType] = useState<ContentType>("VIDEO");
  const [selectedItem, setSelectedItem] = useState<FullContentItem | null>(null);
  const [videoForm, setVideoForm] = useState({ vimeoUrl: "", duration: "", transcript: "" });
  const [quizForm, setQuizForm] = useState({ title: "", passingScore: 70, timeLimit: "" });
  const [noteContent, setNoteContent] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [activeQuizItem, setActiveQuizItem] = useState<FullContentItem | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Re-filter when module content changes
    const filtered = module.contentItems.filter((item) => {
      if (item.contentType === "VIDEO" || item.contentType === "NOTE") {
        return true;
      }
      if (item.contentType === "QUIZ") {
        return item.quiz && !item.quiz.isMockExam;
      }
      return false;
    });
    setItems(filtered);
  }, [module.contentItems]);

  const resetContentForms = () => {
    setVideoForm({ vimeoUrl: "", duration: "", transcript: "" });
    setQuizForm({ title: "", passingScore: 70, timeLimit: "" });
    setNoteContent("");
  };

  const openCreateContentDialog = () => {
    setContentMode("create");
    setSelectedItem(null);
    setContentType("VIDEO");
    resetContentForms();
    setContentDialogOpen(true);
  };

  const openEditContentDialog = (item: FullContentItem) => {
    setContentMode("edit");
    setSelectedItem(item);
    setContentType(item.contentType as ContentType);
    if (item.contentType === "VIDEO" && item.video) {
      setVideoForm({
        vimeoUrl: item.video.vimeoUrl,
        duration: item.video.duration?.toString() ?? "",
        transcript: item.video.transcript ?? "",
      });
    } else if (item.contentType === "QUIZ" && item.quiz) {
      setQuizForm({
        title: item.quiz.title,
        passingScore: item.quiz.passingScore,
        timeLimit: item.quiz.timeLimit?.toString() ?? "",
      });
    } else if (item.contentType === "NOTE") {
      const adminNote = item.notes[0];
      setNoteContent(adminNote?.content ?? "");
    }
    setContentDialogOpen(true);
  };

  const handleContentDialogChange = (open: boolean) => {
    setContentDialogOpen(open);
    if (!open) {
      resetContentForms();
      setSelectedItem(null);
    }
  };

  const handleContentSave = async () => {
    try {
      if (contentMode === "create") {
        const payload: any = {
          moduleId: module.id,
          contentType,
          order: items.length,
          studyPhase: "PHASE_1_LEARN", // Set Phase 1 for module content
        };

        if (contentType === "VIDEO") {
          payload.video = {
            vimeoUrl: videoForm.vimeoUrl,
            duration: videoForm.duration ? Number(videoForm.duration) : undefined,
            transcript: videoForm.transcript || undefined,
          };
        }

        if (contentType === "QUIZ") {
          payload.quiz = {
            title: quizForm.title,
            passingScore: Number(quizForm.passingScore),
            timeLimit: quizForm.timeLimit ? Number(quizForm.timeLimit) : undefined,
          };
        }

        if (contentType === "NOTE") {
          payload.note = {
            content: noteContent,
          };
        }

        const result = await createContentItemAction(payload);
        if (result.success) {
          toast.success("Content added");
          handleContentDialogChange(false);
          onRefresh();
        } else {
          toast.error(result.error || "Error creating");
        }
      } else if (selectedItem) {
        const payload: any = {};

        if (contentType === "VIDEO") {
          payload.video = {
            vimeoUrl: videoForm.vimeoUrl,
            duration: videoForm.duration ? Number(videoForm.duration) : undefined,
            transcript: videoForm.transcript || undefined,
          };
        }

        if (contentType === "QUIZ") {
          payload.quiz = {
            title: quizForm.title,
            passingScore: Number(quizForm.passingScore),
            timeLimit: quizForm.timeLimit ? Number(quizForm.timeLimit) : undefined,
          };
        }

        if (contentType === "NOTE") {
          payload.note = {
            content: noteContent,
          };
        }

        const result = await updateContentItemAction(selectedItem.id, payload);
        if (result.success) {
          toast.success("Content updated");
          handleContentDialogChange(false);
          onRefresh();
        } else {
          toast.error(result.error || "Error updating");
        }
      }
    } catch (error) {
      toast.error("Error saving");
    }
  };

  const handleDeleteContent = async () => {
    if (!selectedItem) return;
    const result = await deleteContentItemAction(selectedItem.id);
    if (result.success) {
      toast.success("Content deleted");
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      // Remove the item from local state immediately
      setItems((prevItems) => prevItems.filter((item) => item.id !== selectedItem.id));
      // Refresh from server
      onRefresh();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleContentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    const payload = reordered.map((item, index) => ({
      id: item.id,
      order: index,
    }));

    const result = await reorderContentItemsAction(module.id, payload);
    if (!result.success) {
      toast.error(result.error || "Error reordering");
      onRefresh();
    } else {
      onRefresh();
    }
  };

  const attachTranscriptLink = (url: string, fileName: string) => {
    setVideoForm((current) => ({
      ...current,
      transcript: `${current.transcript ? `${current.transcript}\n` : ""}${fileName}: ${url}`,
    }));
  };

  const insertAttachmentInNote = (url: string, fileName: string) => {
    setNoteContent((current) => `${current}\n<p><a href="${url}" target="_blank" rel="noreferrer">${fileName}</a></p>`);
  };

  const handleMarkdownUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a markdown file
    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
      toast.error("Please select a Markdown file (.md or .markdown)");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const markdownContent = e.target?.result as string;
        if (!markdownContent) {
          toast.error("Impossible de lire le fichier");
          return;
        }

        // Convert markdown to HTML
        const htmlContent = marked.parse(markdownContent) as string;
        
        // Set the converted HTML to the editor
        setNoteContent(htmlContent);
        toast.success("Markdown document imported successfully");
      };
      reader.onerror = () => {
        toast.error("Error reading the file");
      };
      reader.readAsText(file);
    } catch (error) {
      toast.error("Error importing the Markdown file");
      console.error("Markdown upload error:", error);
    }

    // Reset the input
    if (event.target) {
      event.target.value = "";
    }
  };

  const openQuizBuilderDialog = (item: FullContentItem) => {
    setActiveQuizItem(item);
    setQuizDialogOpen(true);
  };

  const toggleNoteExpansion = (itemId: string) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const renderContentMetadata = (item: FullContentItem) => {
    switch (item.contentType) {
      case "VIDEO":
        return (
          <div className="text-sm text-muted-foreground">
            <p>Vimeo: {item.video?.vimeoUrl}</p>
            {item.video?.duration && <p>Durée: {item.video.duration} sec</p>}
          </div>
        );
      case "QUIZ":
        return (
          <div className="text-sm text-muted-foreground">
            <p>{item.quiz?.title}</p>
            <p>Questions: {item.quiz?.questions.length ?? 0}</p>
          </div>
        );
      case "NOTE":
        const isExpanded = expandedNotes.has(item.id);
        const noteContent = item.notes[0]?.content ?? "Note sans contenu";
        // Create a text preview by stripping HTML tags
        const textPreview = noteContent.replace(/<[^>]*>/g, "").substring(0, 150);
        const hasMoreContent = noteContent.length > 150 || noteContent.includes("<");
        
        return (
          <Collapsible open={isExpanded} onOpenChange={() => toggleNoteExpansion(item.id)}>
            <div className="space-y-2">
              {!isExpanded && hasMoreContent && (
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {textPreview}
                  {textPreview.length >= 150 && "..."}
                </div>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Réduire
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Afficher le contenu complet
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div
                  className="tiptap-editor text-sm text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: noteContent }}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      case "FLASHCARD":
        return (
          <div className="text-sm text-muted-foreground">
            Associe les flashcards du cours à ce module.
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
          <h3 className="text-base font-semibold">Contenu du module</h3>
          <p className="text-sm text-muted-foreground">Organisez vidéos, quiz, notes et flashcards.</p>
        </div>
        <Button size="sm" onClick={openCreateContentDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-muted-foreground">
          Aucun élément pour l'instant.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleContentDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <SortableContentItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => openEditContentDialog(item)}
                  onDelete={() => {
                    setSelectedItem(item);
                    setDeleteDialogOpen(true);
                  }}
                  onManageQuiz={() => openQuizBuilderDialog(item)}
                >
                  {renderContentMetadata(item)}
                </SortableContentItemCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={contentDialogOpen} onOpenChange={handleContentDialogChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>{contentMode === "create" ? "Add content" : "Edit content"}</DialogTitle>
            <DialogDescription>
              Configurez le type et les informations spécifiques au contenu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 overflow-y-auto flex-1 min-h-0">
            {contentMode === "create" && (
              <div className="space-y-2">
                <Label>Type de contenu</Label>
                <Select value={contentType} onValueChange={(value: ContentType) => setContentType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisissez un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">Vidéo (Vimeo)</SelectItem>
                    <SelectItem value="QUIZ">Quiz</SelectItem>
                    <SelectItem value="NOTE">Notes d'étude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {contentType === "VIDEO" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>URL Vimeo *</Label>
                  <Input
                    value={videoForm.vimeoUrl}
                    onChange={(event) => setVideoForm({ ...videoForm, vimeoUrl: event.target.value })}
                    placeholder="https://vimeo.com/..."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Durée (secondes)</Label>
                    <Input
                      type="number"
                      value={videoForm.duration}
                      onChange={(event) => setVideoForm({ ...videoForm, duration: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transcription ou lien</Label>
                    <Textarea
                      value={videoForm.transcript}
                      onChange={(event) => setVideoForm({ ...videoForm, transcript: event.target.value })}
                      placeholder="Notes ou transcript..."
                    />
                    <FileUploadButton
                      folder={`${courseId}/transcripts`}
                      onUploaded={attachTranscriptLink}
                      accept=".txt,.pdf,.doc,.docx"
                      label="Upload a transcript"
                    />
                  </div>
                </div>
              </div>
            )}

            {contentType === "QUIZ" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Titre *</Label>
                  <Input
                    value={quizForm.title}
                    onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })}
                    placeholder="Quiz module 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Score de réussite (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quizForm.passingScore}
                    onChange={(event) => setQuizForm({ ...quizForm, passingScore: Number(event.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Limite de temps (secondes)</Label>
                  <Input
                    type="number"
                    value={quizForm.timeLimit}
                    onChange={(event) => setQuizForm({ ...quizForm, timeLimit: event.target.value })}
                  />
                </div>
              </div>
            )}

            {contentType === "NOTE" && (
              <div className="space-y-2">
                <Label>Contenu de la note</Label>
                <RichTextEditor content={noteContent} onChange={setNoteContent} />
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="file"
                    accept=".md,.markdown"
                    onChange={handleMarkdownUpload}
                    className="hidden"
                    id="markdown-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("markdown-upload")?.click()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Importer un document Markdown
                  </Button>
                  <FileUploadButton
                    folder={`${courseId}/notes`}
                    onUploaded={insertAttachmentInNote}
                    label="Add an attachment"
                  />
                </div>
              </div>
            )}

            {contentType === "FLASHCARD" && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Ce contenu affichera l'ensemble de flashcards du cours pour les étudiants. Gérez les cartes dans l'onglet
                « Flashcards ».
              </div>
            )}

          </div>

          <div className="flex justify-end gap-2 pt-4 pb-6 px-6 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => handleContentDialogChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleContentSave}>
              {contentMode === "create" ? "Create" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le contenu</DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement l'élément de contenu.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteContent}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questions du quiz</DialogTitle>
            <DialogDescription>Ajoutez, éditez et réordonnez les questions.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {activeQuizItem?.quiz ? (
              <QuizBuilder
                quizId={activeQuizItem.quiz.id}
                questions={activeQuizItem.quiz.questions as QuizQuestion[]}
                onChanged={() => {
                  onRefresh();
                }}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Ce contenu n'a pas de quiz associé.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableContentItemCardProps {
  item: FullContentItem;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onManageQuiz: () => void;
}

function SortableContentItemCard({ item, children, onEdit, onDelete, onManageQuiz }: SortableContentItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const icon = (() => {
    switch (item.contentType) {
      case "VIDEO":
        return <Video className="h-4 w-4 text-primary" />;
      case "QUIZ":
        return <FileQuestion className="h-4 w-4 text-primary" />;
      case "NOTE":
        return <StickyNote className="h-4 w-4 text-primary" />;
      case "FLASHCARD":
        return <Layers className="h-4 w-4 text-primary" />;
      default:
        return null;
    }
  })();

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-muted/10 p-4 flex gap-4 items-start">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground mt-1"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{item.contentType}</span>
        </div>
        {children}
      </div>
      <div className="flex flex-col gap-2">
        {item.contentType === "QUIZ" && (
          <Button variant="outline" size="sm" onClick={onManageQuiz}>
            Questions
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

