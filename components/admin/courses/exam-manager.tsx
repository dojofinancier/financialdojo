"use client";

import { useEffect, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getExamsAction, upsertExamAction, deleteExamAction, uploadQuestionsToExamAction, cleanupEscapedQuotesAction, importPracticeExamFromCSVAction } from "@/app/actions/exams";
import { getModulesAction } from "@/app/actions/modules";
import { createContentItemAction } from "@/app/actions/content-items";
import { createQuizQuestionAction, updateQuizQuestionAction, deleteQuizQuestionAction } from "@/app/actions/content-items";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Clock, Target, Upload, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface ExamManagerProps {
  courseId: string;
}

type Exam = {
  id: string;
  title: string;
  passingScore: number;
  timeLimit: number | null;
  examFormat: string | null;
  contentItem: {
    id: string;
    module: {
      id: string;
      title: string;
    };
  };
  questions: Array<{
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    order: number;
  }>;
};

function normalizeQuestionOptions(value: unknown): Record<string, string> {
  const toRecord = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const obj = v as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, raw] of Object.entries(obj)) {
      if (raw == null) continue;
      out[k] = typeof raw === "string" ? raw : String(raw);
    }
    return out;
  };

  if (typeof value === "string") {
    try {
      return toRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return toRecord(value);
}

function normalizeExams(raw: unknown): Exam[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((exam: any) => ({
    ...exam,
    questions: Array.isArray(exam.questions)
      ? exam.questions.map((q: any) => ({
          ...q,
          options: normalizeQuestionOptions(q.options),
        }))
      : [],
  }));
}

export function ExamManager({ courseId }: ExamManagerProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [firstModuleId, setFirstModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [questionEditDialogOpen, setQuestionEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importPracticeExamDialogOpen, setImportPracticeExamDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importExamTitle, setImportExamTitle] = useState("");
  const [importModuleId, setImportModuleId] = useState<string | null>(null);
  const [importExistingExamId, setImportExistingExamId] = useState<string | null>(null);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<{
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    order: number;
  } | null>(null);
  const [examFormState, setExamFormState] = useState({
    title: "",
    passingScore: 70,
    timeLimit: 120, // minutes
    examFormat: "",
    contentItemId: "" as string | null,
  });
  const [questionFormState, setQuestionFormState] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
  });

  const loadExams = async () => {
    setLoading(true);
    try {
      const result = await getExamsAction(courseId);
      if (result.success && result.data) {
        setExams(normalizeExams(result.data));
      } else {
        console.error("Exam loading error:", result.error);
        setExams([]);
        if (result.error) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      console.error("Exam loading exception:", error);
      toast.error("Error loading exams");
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
    loadFirstModule();
  }, [courseId]);

  const loadFirstModule = async () => {
    try {
      const modulesData = await getModulesAction(courseId);
      setModules(modulesData);
      if (modulesData.length > 0) {
        setFirstModuleId(modulesData[0].id);
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  };

  const openCreateExamDialog = () => {
    setEditingExam(null);
    setExamFormState({
      title: "",
      passingScore: 70,
      timeLimit: 120,
      examFormat: "",
      contentItemId: null,
    });
    setExamDialogOpen(true);
  };

  const openEditExamDialog = (exam: Exam) => {
    setEditingExam(exam);
    setExamFormState({
      title: exam.title,
      passingScore: exam.passingScore,
      timeLimit: exam.timeLimit ? Math.floor(exam.timeLimit / 60) : 120,
      examFormat: exam.examFormat || "",
      contentItemId: exam.contentItem.id,
    });
    setExamDialogOpen(true);
  };

  const handleExamSubmit = async () => {
    if (!examFormState.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    if (!firstModuleId) {
      toast.error("No modules found. Please create a module first.");
      return;
    }

    let contentItemId = examFormState.contentItemId;

    // Create content item if it doesn't exist
    if (!contentItemId && !editingExam) {
      const contentItemResult = await createContentItemAction({
        moduleId: firstModuleId,
        contentType: "QUIZ",
        order: 0,
      });

      if (!contentItemResult.success || !contentItemResult.data) {
        toast.error(contentItemResult.error || "Error creating the content item");
        return;
      }

      contentItemId = contentItemResult.data.id;
    }

    const result = await upsertExamAction(editingExam?.id || null, {
      title: examFormState.title,
      passingScore: examFormState.passingScore,
      timeLimit: examFormState.timeLimit,
      examFormat: examFormState.examFormat || null,
      contentItemId: contentItemId || editingExam!.contentItem.id,
    });

    if (result.success) {
      toast.success(editingExam ? "Exam updated" : "Exam created");
      setExamDialogOpen(false);
      await loadExams();
      
      // If creating new exam, open questions dialog
      if (!editingExam && result.data) {
        const newExam = result.data;
        setSelectedExam(newExam);
        setQuestionsDialogOpen(true);
      }
    } else {
      toast.error(result.error || "Error saving");
    }
  };

  const handleDelete = async (examId: string) => {
    if (!confirm("Are you sure you want to delete this exam?")) {
      return;
    }

    const result = await deleteExamAction(examId);
    if (result.success) {
      toast.success("Exam deleted");
      loadExams();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const openQuestionsDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setQuestionsDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedExam) return;

    try {
      const fileContent = await file.text();
      const result = await uploadQuestionsToExamAction(selectedExam.id, fileContent);

      if (result.success) {
        toast.success(`Questions imported successfully`);
        setUploadDialogOpen(false);
        await loadExams();
        // Refresh selected exam
        const updatedResult = await getExamsAction(courseId);
        if (updatedResult.success && updatedResult.data) {
          const updatedExam = normalizeExams(updatedResult.data).find((e) => e.id === selectedExam.id);
          if (updatedExam) {
            setSelectedExam(updatedExam);
          }
        }
      } else {
        toast.error(result.error || "Error during import");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error("Error importing file");
    } finally {
      event.target.value = "";
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedExam) return;

    if (!questionFormState.question.trim()) {
      toast.error("La question est requise");
      return;
    }

    if (!questionFormState.optionA.trim() || !questionFormState.optionB.trim()) {
      toast.error("Au moins deux options (A et B) sont requises");
      return;
    }

    const options: Record<string, string> = {};
    if (questionFormState.optionA.trim()) options["option1"] = questionFormState.optionA.trim();
    if (questionFormState.optionB.trim()) options["option2"] = questionFormState.optionB.trim();
    if (questionFormState.optionC.trim()) options["option3"] = questionFormState.optionC.trim();
    if (questionFormState.optionD.trim()) options["option4"] = questionFormState.optionD.trim();

    // Map correct answer to option key
    const correctAnswerMap: Record<string, string> = {
      A: "option1",
      B: "option2",
      C: "option3",
      D: "option4",
    };
    const correctAnswer = correctAnswerMap[questionFormState.correctAnswer] || "option1";

    if (!options[correctAnswer]) {
      toast.error("The correct answer must correspond to a valid option");
      return;
    }

    // Get next order
    const nextOrder = selectedExam.questions.length > 0
      ? Math.max(...selectedExam.questions.map(q => q.order)) + 1
      : 1;

    try {
      const result = await createQuizQuestionAction({
        quizId: selectedExam.id,
        type: "MULTIPLE_CHOICE",
        question: questionFormState.question.trim(),
        options,
        correctAnswer,
        order: nextOrder,
      });

      if (result.success) {
        toast.success("Question added");
        setQuestionFormState({
          question: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctAnswer: "A",
        });
        await loadExams();
        // Refresh selected exam
        const updatedResult = await getExamsAction(courseId);
        if (updatedResult.success && updatedResult.data) {
          const updatedExam = normalizeExams(updatedResult.data).find((e) => e.id === selectedExam.id);
          if (updatedExam) {
            setSelectedExam(updatedExam);
          }
        }
      } else {
        toast.error(result.error || "Error adding");
      }
    } catch (error) {
      console.error("Error adding question:", error);
      toast.error("Error adding the question");
    }
  };

  const openEditQuestionDialog = (question: {
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    order: number;
  }) => {
    setEditingQuestion(question);
    // Map options back to A, B, C, D format
    const optionKeys = Object.keys(question.options).sort();
    const optionValues = Object.values(question.options);
    
    // Find which option is correct
    let correctAnswerKey = "A";
    if (question.correctAnswer === "option1" || question.correctAnswer === optionKeys[0]) correctAnswerKey = "A";
    else if (question.correctAnswer === "option2" || question.correctAnswer === optionKeys[1]) correctAnswerKey = "B";
    else if (question.correctAnswer === "option3" || question.correctAnswer === optionKeys[2]) correctAnswerKey = "C";
    else if (question.correctAnswer === "option4" || question.correctAnswer === optionKeys[3]) correctAnswerKey = "D";

    setQuestionFormState({
      question: question.question,
      optionA: optionValues[0] || "",
      optionB: optionValues[1] || "",
      optionC: optionValues[2] || "",
      optionD: optionValues[3] || "",
      correctAnswer: correctAnswerKey,
    });
    setQuestionEditDialogOpen(true);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !selectedExam) return;

    if (!questionFormState.question.trim()) {
      toast.error("La question est requise");
      return;
    }

    if (!questionFormState.optionA.trim() || !questionFormState.optionB.trim()) {
      toast.error("Au moins deux options (A et B) sont requises");
      return;
    }

    const options: Record<string, string> = {};
    if (questionFormState.optionA.trim()) options["option1"] = questionFormState.optionA.trim();
    if (questionFormState.optionB.trim()) options["option2"] = questionFormState.optionB.trim();
    if (questionFormState.optionC.trim()) options["option3"] = questionFormState.optionC.trim();
    if (questionFormState.optionD.trim()) options["option4"] = questionFormState.optionD.trim();

    const correctAnswerMap: Record<string, string> = {
      A: "option1",
      B: "option2",
      C: "option3",
      D: "option4",
    };
    const correctAnswer = correctAnswerMap[questionFormState.correctAnswer] || "option1";

    if (!options[correctAnswer]) {
      toast.error("The correct answer must correspond to a valid option");
      return;
    }

    try {
      const result = await updateQuizQuestionAction(editingQuestion.id, {
        question: questionFormState.question.trim(),
        options,
        correctAnswer,
      });

      if (result.success) {
        toast.success("Question updated");
        setQuestionEditDialogOpen(false);
        setEditingQuestion(null);
        await loadExams();
        // Refresh selected exam
        const updatedResult = await getExamsAction(courseId);
        if (updatedResult.success && updatedResult.data) {
          const updatedExam = normalizeExams(updatedResult.data).find((e) => e.id === selectedExam.id);
          if (updatedExam) {
            setSelectedExam(updatedExam);
          }
        }
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error("Error updating");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      const result = await deleteQuizQuestionAction(questionId);
      if (result.success) {
        toast.success("Question deleted");
        await loadExams();
        // Refresh selected exam
        if (selectedExam) {
          const updatedResult = await getExamsAction(courseId);
          if (updatedResult.success && updatedResult.data) {
            const updatedExam = normalizeExams(updatedResult.data).find((e) => e.id === selectedExam.id);
            if (updatedExam) {
              setSelectedExam(updatedExam);
            }
          }
        }
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Error while deleting");
    }
  };

  const handleCleanupEscapedQuotes = async (examId: string) => {
    if (!confirm("Voulez-vous nettoyer les guillemets échappés (\\') dans toutes les questions de cet examen ?")) {
      return;
    }

    try {
      const result = await cleanupEscapedQuotesAction(examId);
      if (result.success) {
        toast.success(`${result.data?.updatedCount || 0} question(s) mise(s) à jour`);
        await loadExams();
        // Refresh selected exam if it's the one we cleaned
        if (selectedExam && selectedExam.id === examId) {
          const updatedResult = await getExamsAction(courseId);
          if (updatedResult.success && updatedResult.data) {
            const updatedExam = normalizeExams(updatedResult.data).find((e) => e.id === examId);
            if (updatedExam) {
              setSelectedExam(updatedExam);
            }
          }
        }
      } else {
        toast.error(result.error || "Error during cleaning");
      }
    } catch (error) {
      console.error("Error cleaning up escaped quotes:", error);
      toast.error("Error during cleaning");
    }
  };

  const handleImportPracticeExam = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileContent = await file.text();
      const result = await importPracticeExamFromCSVAction(
        courseId,
        fileContent,
        importExamTitle || undefined,
        importModuleId || undefined,
        importExistingExamId || undefined
      );

      if (result.success) {
        const data = result.data as any;
        toast.success(
          `${data?.questionsAdded || 0} question(s) importée(s) avec succès${data?.errors?.length ? ` (${data.errors.length} erreurs)` : ""}`
        );
        setImportPracticeExamDialogOpen(false);
        setImportExamTitle("");
        setImportModuleId(null);
        setImportExistingExamId(null);
        await loadExams();
        
        // If errors occurred, show them
        if (data?.errors && data.errors.length > 0) {
          console.warn("Import errors:", data.errors);
        }
      } else {
        toast.error(result.error || "Error during import");
      }
    } catch (error) {
      console.error("Error importing practice exam:", error);
      toast.error("Error importing file");
    } finally {
      setImporting(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Examens simulés</h2>
          <p className="text-sm text-muted-foreground">
            Créez des examens simulés chronométrés pour les étudiants.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importPracticeExamDialogOpen} onOpenChange={(open) => {
            setImportPracticeExamDialogOpen(open);
            if (!open) {
              setImportExamTitle("");
              setImportModuleId(null);
              setImportExistingExamId(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importer examen pratique
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importer un examen pratique depuis CSV</DialogTitle>
                <DialogDescription>
                  Format attendu: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Fichier CSV *</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleImportPracticeExam}
                    disabled={importing}
                  />
                  {importing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importation en cours...
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Titre de l'examen (optionnel)</Label>
                  <Input
                    value={importExamTitle}
                    onChange={(e) => setImportExamTitle(e.target.value)}
                    placeholder="Leave blank to use a default title"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si vide, un titre par défaut sera généré avec la date.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Module (optionnel)</Label>
                  <Select
                    value={importModuleId || "none"}
                    onValueChange={(value) => setImportModuleId(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Utiliser le premier module</SelectItem>
                      {modules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si non spécifié, le premier module du cours sera utilisé.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Ajouter à un examen existant (optionnel)</Label>
                  <Select
                    value={importExistingExamId || "none"}
                    onValueChange={(value) => setImportExistingExamId(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Create a new exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Créer un nouvel examen</SelectItem>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si sélectionné, les questions seront ajoutées à cet examen existant.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le format CSV attendu est: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
                  <br />
                  Les colonnes option_c, option_d et explanation sont optionnelles.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateExamDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel examen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExam ? "Edit the exam" : "Create an exam"}</DialogTitle>
                <DialogDescription>
                  {editingExam ? "Edit the exam settings." : "Step 1/2: Configure the exam settings. You will be able to add the questions afterwards."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Titre de l'examen *</Label>
                  <Input
                    value={examFormState.title}
                    onChange={(e) => setExamFormState({ ...examFormState, title: e.target.value })}
                    placeholder="Ex: Examen final - Chapitre 1-3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Durée (minutes) *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={examFormState.timeLimit}
                      onChange={(e) => setExamFormState({ ...examFormState, timeLimit: parseInt(e.target.value) || 120 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Note de passage (%) *</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={examFormState.passingScore}
                      onChange={(e) => setExamFormState({ ...examFormState, passingScore: parseInt(e.target.value) || 70 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Format de l'examen (optionnel)</Label>
                  <Textarea
                    value={examFormState.examFormat}
                    onChange={(e) => setExamFormState({ ...examFormState, examFormat: e.target.value })}
                    placeholder="Description du format de l'examen..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExamDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleExamSubmit}>
                    {editingExam ? "Enregistrer" : "Create and add questions"}
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
          Chargement des examens...
        </div>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun examen simulé pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <Card key={exam.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <CardTitle className="text-lg">{exam.title}</CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {exam.timeLimit ? `${Math.floor(exam.timeLimit / 60)} min` : "Sans limite"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      {exam.passingScore}% pour réussir
                    </div>
                    <div>
                      {exam.questions.length} question{exam.questions.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  {exam.examFormat && (
                    <p className="text-sm text-muted-foreground mt-2">{exam.examFormat}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (expandedExamId === exam.id) {
                        setExpandedExamId(null);
                      } else {
                        setExpandedExamId(exam.id);
                      }
                    }}
                  >
                    {expandedExamId === exam.id ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Masquer
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Questions
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCleanupEscapedQuotes(exam.id)}
                    title="Clean escaped quotes (\\\\')"
                  >
                    Nettoyer
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditExamDialog(exam)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(exam.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              {expandedExamId === exam.id && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Questions ({exam.questions.length})</h3>
                      <div className="flex gap-2">
                        <Dialog open={uploadDialogOpen && selectedExam?.id === exam.id} onOpenChange={(open) => {
                          setUploadDialogOpen(open);
                          if (!open) setSelectedExam(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExam(exam);
                                setUploadDialogOpen(true);
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Importer CSV
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Importer des questions depuis CSV</DialogTitle>
                              <DialogDescription>
                                Format attendu: settings, question, answer (format Tutor)
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label>Fichier CSV *</Label>
                                <Input
                                  type="file"
                                  accept=".csv"
                                  onChange={handleFileUpload}
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          onClick={() => openQuestionsDialog(exam)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter une question
                        </Button>
                      </div>
                    </div>
                    {exam.questions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune question. Ajoutez des questions pour commencer.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Options</TableHead>
                            <TableHead>Réponse correcte</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exam.questions.map((question, idx) => {
                            const optionKeys = Object.keys(question.options).sort();
                            const correctOptionKey = question.correctAnswer;
                            const correctOptionValue = question.options[correctOptionKey] || "";
                            
                            return (
                              <TableRow key={question.id}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="max-w-md">{question.question}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {optionKeys.map((key) => (
                                      <div key={key} className="text-sm">
                                        <span className="font-medium">{key}:</span> {question.options[key]}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="default">{correctOptionValue}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditQuestionDialog(question)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteQuestion(question.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Questions Management Dialog */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gérer les questions - {selectedExam?.title}</DialogTitle>
            <DialogDescription>
              Ajoutez, modifiez ou supprimez des questions pour cet examen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Questions ({selectedExam?.questions.length || 0})</h3>
              <div className="flex gap-2">
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Importer CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Importer des questions depuis CSV</DialogTitle>
                      <DialogDescription>
                        Format attendu: settings, question, answer (format Tutor)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Fichier CSV *</Label>
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Add Question Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ajouter une question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Question *</Label>
                  <Textarea
                    value={questionFormState.question}
                    onChange={(e) => setQuestionFormState({ ...questionFormState, question: e.target.value })}
                    placeholder="Entrez la question..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Option A *</Label>
                    <Input
                      value={questionFormState.optionA}
                      onChange={(e) => setQuestionFormState({ ...questionFormState, optionA: e.target.value })}
                      placeholder="Option A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Option B *</Label>
                    <Input
                      value={questionFormState.optionB}
                      onChange={(e) => setQuestionFormState({ ...questionFormState, optionB: e.target.value })}
                      placeholder="Option B"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Option C</Label>
                    <Input
                      value={questionFormState.optionC}
                      onChange={(e) => setQuestionFormState({ ...questionFormState, optionC: e.target.value })}
                      placeholder="Option C"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Option D</Label>
                    <Input
                      value={questionFormState.optionD}
                      onChange={(e) => setQuestionFormState({ ...questionFormState, optionD: e.target.value })}
                      placeholder="Option D"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Réponse correcte *</Label>
                  <Select
                    value={questionFormState.correctAnswer}
                    onValueChange={(value) => setQuestionFormState({ ...questionFormState, correctAnswer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddQuestion} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter la question
                </Button>
              </CardContent>
            </Card>

            {/* Questions List */}
            {selectedExam && selectedExam.questions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Questions existantes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Réponse correcte</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedExam.questions.map((question, idx) => {
                      const optionKeys = Object.keys(question.options).sort();
                      const correctOptionKey = question.correctAnswer;
                      const correctOptionValue = question.options[correctOptionKey] || "";
                      
                      return (
                        <TableRow key={question.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="max-w-md">{question.question}</TableCell>
                          <TableCell>
                            <Badge variant="default">{correctOptionValue}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditQuestionDialog(question)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteQuestion(question.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={questionEditDialogOpen} onOpenChange={setQuestionEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Question *</Label>
              <Textarea
                value={questionFormState.question}
                onChange={(e) => setQuestionFormState({ ...questionFormState, question: e.target.value })}
                placeholder="Entrez la question..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Option A *</Label>
                <Input
                  value={questionFormState.optionA}
                  onChange={(e) => setQuestionFormState({ ...questionFormState, optionA: e.target.value })}
                  placeholder="Option A"
                />
              </div>
              <div className="space-y-2">
                <Label>Option B *</Label>
                <Input
                  value={questionFormState.optionB}
                  onChange={(e) => setQuestionFormState({ ...questionFormState, optionB: e.target.value })}
                  placeholder="Option B"
                />
              </div>
              <div className="space-y-2">
                <Label>Option C</Label>
                <Input
                  value={questionFormState.optionC}
                  onChange={(e) => setQuestionFormState({ ...questionFormState, optionC: e.target.value })}
                  placeholder="Option C"
                />
              </div>
              <div className="space-y-2">
                <Label>Option D</Label>
                <Input
                  value={questionFormState.optionD}
                  onChange={(e) => setQuestionFormState({ ...questionFormState, optionD: e.target.value })}
                  placeholder="Option D"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Réponse correcte *</Label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={questionFormState.correctAnswer}
                onChange={(e) => setQuestionFormState({ ...questionFormState, correctAnswer: e.target.value })}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuestionEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateQuestion}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
