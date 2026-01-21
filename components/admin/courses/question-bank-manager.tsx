"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Upload, Trash2, FileText, Edit } from "lucide-react";
import {
  getQuestionBanksAction,
  createQuestionBankAction,
  updateQuestionBankAction,
  deleteQuestionBankAction,
  uploadQuestionsFromCSVAction,
  uploadQuizCSVToModulesAction,
  getPhase1QuizzesAction,
  addQuestionBankToPhase1QuizAction,
  addSelectedQuestionsToPhase1QuizAction,
  deleteQuestionFromBankAction,
  updateQuestionInBankAction,
} from "@/app/actions/question-banks";
import { getModulesAction } from "@/app/actions/modules";

interface QuestionBankManagerProps {
  courseId: string;
}

interface QuestionBank {
  id: string;
  title: string;
  description: string | null;
  moduleId: string | null;
  module?: {
    id: string;
    title: string;
  } | null;
  questions: Array<{
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    explanation: string | null;
  }>;
  _count: {
    questions: number;
  };
}

export function QuestionBankManager({ courseId }: QuestionBankManagerProps) {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadQuizDialogOpen, setUploadQuizDialogOpen] = useState(false);
  const [assignToPhase1DialogOpen, setAssignToPhase1DialogOpen] = useState(false);
  const [questionEditDialogOpen, setQuestionEditDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [assignToPhase1, setAssignToPhase1] = useState(false);
  const [phase1Quizzes, setPhase1Quizzes] = useState<Array<{ id: string; title: string; moduleId: string; moduleTitle: string }>>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [batchSelectedQuestionIds, setBatchSelectedQuestionIds] = useState<Map<string, Set<string>>>(new Map()); // bankId -> Set of questionIds
  const [assignSingleQuestionDialogOpen, setAssignSingleQuestionDialogOpen] = useState(false);
  const [singleQuestionId, setSingleQuestionId] = useState<string>("");
  const [batchAssignDialogOpen, setBatchAssignDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    explanation: string | null;
  } | null>(null);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    moduleId: null as string | null,
  });
  const [questionFormState, setQuestionFormState] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    explanation: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadQuestionBanks();
    loadModules();
    loadPhase1Quizzes();
  }, [courseId]);

  const loadPhase1Quizzes = async () => {
    try {
      const result = await getPhase1QuizzesAction(courseId);
      if (result.success && result.data) {
        setPhase1Quizzes(result.data as any);
      }
    } catch (error) {
      console.error("Error loading Phase 1 quizzes:", error);
    }
  };

  const loadQuestionBanks = async () => {
    setLoading(true);
    try {
      const result = await getQuestionBanksAction(courseId);
      if (result.success && result.data) {
        setQuestionBanks(result.data);
      } else {
        toast.error(result.error || "Error loading question banks");
        setQuestionBanks([]);
      }
    } catch (error) {
      console.error("Error loading question banks:", error);
      toast.error("Error loading question banks");
      setQuestionBanks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const modulesData = await getModulesAction(courseId);
      setModules(modulesData);
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  };

  const openCreateDialog = () => {
    setFormState({
      title: "",
      description: "",
      moduleId: null,
    });
    setSelectedBankId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (bank: QuestionBank) => {
    setFormState({
      title: bank.title,
      description: bank.description || "",
      moduleId: bank.moduleId || null,
    });
    setSelectedBankId(bank.id);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formState.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    try {
      const result = selectedBankId
        ? await updateQuestionBankAction(selectedBankId, {
            ...formState,
            courseId,
          })
        : await createQuestionBankAction({
            ...formState,
            courseId,
          });

      if (result.success) {
        toast.success(
          selectedBankId
            ? "Question bank updated"
            : "Question bank created"
        );
        setDialogOpen(false);
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error saving");
      }
    } catch (error) {
      console.error("Error saving question bank:", error);
      toast.error("Error saving");
    }
  };

  const handleDelete = async (bankId: string) => {
    if (!confirm("Are you sure you want to delete this question bank? All questions will also be deleted.")) {
      return;
    }

    try {
      const result = await deleteQuestionBankAction(bankId);
      if (result.success) {
        toast.success("Question bank deleted");
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      console.error("Error deleting question bank:", error);
      toast.error("Error while deleting");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedBankId) {
      toast.error("Please select or create a question bank first");
      return;
    }

    setUploading(true);
    try {
      const fileContent = await file.text();
      const result = await uploadQuestionsFromCSVAction(selectedBankId, fileContent);

      if (result.success) {
        toast.success(`${result.data?.count || 0} questions importées avec succès`);
        setUploadDialogOpen(false);
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error during import");
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error("Error importing file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleQuizCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileContent = await file.text();
      const result = await uploadQuizCSVToModulesAction(courseId, fileContent, assignToPhase1);

      if (result.success) {
        const data = result.data as any;
        const phaseText = assignToPhase1 ? "Phase 1" : "Phase 3";
        toast.success(
          `${data?.totalQuestions || 0} questions importées dans ${data?.chaptersProcessed || 0} chapitre(s) (${phaseText})`
        );
        setUploadQuizDialogOpen(false);
        setAssignToPhase1(false);
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error during import");
      }
    } catch (error) {
      console.error("Error uploading quiz CSV:", error);
      toast.error("Error importing file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const openEditQuestionDialog = (question: {
    id: string;
    question: string;
    options: Record<string, string>;
    correctAnswer: string;
    explanation: string | null;
  }) => {
    setEditingQuestion(question);
    // Get options in order (A, B, C, D) or use whatever keys exist
    const optionKeys = Object.keys(question.options).sort();
    setQuestionFormState({
      question: question.question,
      optionA: question.options["A"] || question.options[optionKeys[0]] || "",
      optionB: question.options["B"] || question.options[optionKeys[1]] || "",
      optionC: question.options["C"] || question.options[optionKeys[2]] || "",
      optionD: question.options["D"] || question.options[optionKeys[3]] || "",
      correctAnswer: question.correctAnswer || optionKeys[0] || "A",
      explanation: question.explanation || "",
    });
    setQuestionEditDialogOpen(true);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return;

    if (!questionFormState.question.trim()) {
      toast.error("La question est requise");
      return;
    }

    if (!questionFormState.optionA.trim() || !questionFormState.optionB.trim()) {
      toast.error("Au moins deux options (A et B) sont requises");
      return;
    }

    const options: Record<string, string> = {};
    if (questionFormState.optionA.trim()) options["A"] = questionFormState.optionA.trim();
    if (questionFormState.optionB.trim()) options["B"] = questionFormState.optionB.trim();
    if (questionFormState.optionC.trim()) options["C"] = questionFormState.optionC.trim();
    if (questionFormState.optionD.trim()) options["D"] = questionFormState.optionD.trim();

    if (!options[questionFormState.correctAnswer]) {
      toast.error("The correct answer must correspond to a valid option");
      return;
    }

    try {
      const result = await updateQuestionInBankAction(editingQuestion.id, {
        question: questionFormState.question.trim(),
        options,
        correctAnswer: questionFormState.correctAnswer,
        explanation: questionFormState.explanation.trim() || null,
      });

      if (result.success) {
        toast.success("Question updated");
        setQuestionEditDialogOpen(false);
        setEditingQuestion(null);
        loadQuestionBanks();
      } else {
        console.error("Update question error:", result.error);
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error(`Erreur lors de la mise à jour: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      const result = await deleteQuestionFromBankAction(questionId);
      if (result.success) {
        toast.success("Question deleted");
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Error while deleting");
    }
  };

  const handleAssignToPhase1 = async (bankId: string, allQuestions: boolean = true) => {
    if (!selectedQuizId) {
      toast.error("Please select a quiz");
      return;
    }

    setUploading(true);
    try {
      let result;
      if (allQuestions) {
        result = await addQuestionBankToPhase1QuizAction(bankId, selectedQuizId);
      } else {
        if (selectedQuestionIds.size === 0) {
          toast.error("Please select at least one question");
          setUploading(false);
          return;
        }
        result = await addSelectedQuestionsToPhase1QuizAction(
          Array.from(selectedQuestionIds),
          selectedQuizId
        );
      }

      if (result.success) {
        toast.success(`${result.data?.count || 0} question(s) ajoutée(s) au quiz`);
        setAssignToPhase1DialogOpen(false);
        setSelectedQuizId("");
        setSelectedQuestionIds(new Set());
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error adding questions");
      }
    } catch (error) {
      console.error("Error assigning questions to Phase 1:", error);
      toast.error("Error adding questions");
    } finally {
      setUploading(false);
    }
  };

  const openAssignToPhase1Dialog = (bankId: string) => {
    setSelectedBankId(bankId);
    setSelectedQuizId("");
    setSelectedQuestionIds(new Set());
    setAssignToPhase1DialogOpen(true);
  };

  const openAssignSingleQuestionDialog = (questionId: string) => {
    setSingleQuestionId(questionId);
    setSelectedQuizId("");
    setAssignSingleQuestionDialogOpen(true);
  };

  const handleAssignSingleQuestion = async () => {
    if (!selectedQuizId || !singleQuestionId) {
      toast.error("Please select a quiz");
      return;
    }

    setUploading(true);
    try {
      const result = await addSelectedQuestionsToPhase1QuizAction(
        [singleQuestionId],
        selectedQuizId
      );

      if (result.success) {
        toast.success("Question added to the quiz");
        setAssignSingleQuestionDialogOpen(false);
        setSingleQuestionId("");
        setSelectedQuizId("");
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error adding the question");
      }
    } catch (error) {
      console.error("Error assigning question to Phase 1:", error);
      toast.error("Error adding the question");
    } finally {
      setUploading(false);
    }
  };

  const toggleQuestionSelection = (bankId: string, questionId: string) => {
    setBatchSelectedQuestionIds((prev) => {
      const newMap = new Map(prev);
      const bankSelections = newMap.get(bankId) || new Set<string>();
      const newBankSelections = new Set(bankSelections);
      
      if (newBankSelections.has(questionId)) {
        newBankSelections.delete(questionId);
      } else {
        newBankSelections.add(questionId);
      }
      
      if (newBankSelections.size === 0) {
        newMap.delete(bankId);
      } else {
        newMap.set(bankId, newBankSelections);
      }
      
      return newMap;
    });
  };

  const toggleAllQuestionsInBank = (bankId: string, allQuestionIds: string[]) => {
    setBatchSelectedQuestionIds((prev) => {
      const newMap = new Map(prev);
      const bankSelections = newMap.get(bankId) || new Set<string>();
      const allSelected = allQuestionIds.every(id => bankSelections.has(id));
      
      if (allSelected) {
        // Deselect all
        newMap.delete(bankId);
      } else {
        // Select all
        newMap.set(bankId, new Set(allQuestionIds));
      }
      
      return newMap;
    });
  };

  const getSelectedQuestionsForBank = (bankId: string): Set<string> => {
    return batchSelectedQuestionIds.get(bankId) || new Set();
  };

  const getAllSelectedQuestions = (): string[] => {
    const allSelected: string[] = [];
    batchSelectedQuestionIds.forEach((questionIds) => {
      questionIds.forEach((id) => allSelected.push(id));
    });
    return allSelected;
  };

  const openBatchAssignDialog = () => {
    const selected = getAllSelectedQuestions();
    if (selected.length === 0) {
      toast.error("Please select at least one question");
      return;
    }
    setSelectedQuestionIds(new Set(selected));
    setSelectedQuizId("");
    setBatchAssignDialogOpen(true);
  };

  const handleBatchAssign = async () => {
    const selected = getAllSelectedQuestions();
    if (!selectedQuizId || selected.length === 0) {
      toast.error("Please select a quiz and at least one question");
      return;
    }

    setUploading(true);
    try {
      const result = await addSelectedQuestionsToPhase1QuizAction(
        selected,
        selectedQuizId
      );

      if (result.success) {
        toast.success(`${result.data?.count || selected.length} question(s) ajoutée(s) au quiz`);
        setBatchAssignDialogOpen(false);
        setSelectedQuizId("");
        setBatchSelectedQuestionIds(new Map());
        setSelectedQuestionIds(new Set());
        loadQuestionBanks();
      } else {
        toast.error(result.error || "Error adding questions");
      }
    } catch (error) {
      console.error("Error assigning questions to Phase 1:", error);
      toast.error("Error adding questions");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement des banques de questions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Banques de questions</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les banques de questions MCQ pour la Phase 3 (Pratique). Les questions sont servies aléatoirement.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadQuizDialogOpen} onOpenChange={(open) => {
            setUploadQuizDialogOpen(open);
            if (!open) {
              setAssignToPhase1(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importer Quiz CSV (par chapitre)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importer des questions depuis un fichier CSV de quiz</DialogTitle>
                <DialogDescription>
                  Format attendu: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
                  <br />
                  Les questions seront automatiquement assignées aux modules correspondants selon le numéro de chapitre.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Phase d'assignation</Label>
                  <Select
                    value={assignToPhase1 ? "phase1" : "phase3"}
                    onValueChange={(value) => setAssignToPhase1(value === "phase1")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phase3">Phase 3 - Pratique (Question Bank)</SelectItem>
                      <SelectItem value="phase1">Phase 1 - Apprentissage (Quiz)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {assignToPhase1 
                      ? "Questions will be created as quizzes in Phase 1 (learning with the module)"
                      : "Questions will be added to a question bank for Phase 3 (practice)"}
                  </p>
                </div>
                <div>
                  <Label>Fichier CSV</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleQuizCSVUpload}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importation en cours...
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Le format attendu est: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
                  <br />
                  Le champ "chapter" doit être au format "Chapitre X" où X est le numéro du module.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle banque
          </Button>
        </div>
      </div>

      {questionBanks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Aucune banque de questions pour le moment.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une banque de questions
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questionBanks.map((bank) => (
            <Card key={bank.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {bank.title}
                      {bank.module && (
                        <Badge variant="secondary">{bank.module.title}</Badge>
                      )}
                    </CardTitle>
                    {bank.description && (
                      <CardDescription className="mt-2">{bank.description}</CardDescription>
                    )}
                    <div className="mt-2 text-sm text-muted-foreground">
                      {bank._count.questions} question{bank._count.questions !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={uploadDialogOpen && selectedBankId === bank.id} onOpenChange={(open) => {
                      setUploadDialogOpen(open);
                      if (!open) setSelectedBankId(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBankId(bank.id);
                            setUploadDialogOpen(true);
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Importer CSV
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Importer des questions depuis un fichier CSV</DialogTitle>
                          <DialogDescription>
                            Sélectionnez un fichier CSV au format: question,answer,answer,answer,answer
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label>Fichier CSV</Label>
                            <Input
                              type="file"
                              accept=".csv"
                              onChange={handleFileUpload}
                              disabled={uploading}
                            />
                            {uploading && (
                              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Importation en cours...
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Format attendu: première ligne "settings", puis lignes "question" suivies de lignes "answer".
                            Les réponses correctes sont marquées avec "1" dans la colonne 4.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssignToPhase1Dialog(bank.id)}
                      disabled={bank._count.questions === 0}
                    >
                      Assigner à Phase 1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(bank)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(bank.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {bank.questions.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      const selectedCount = getSelectedQuestionsForBank(bank.id).size;
                      return selectedCount > 0 ? (
                        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <span className="text-sm font-medium">
                            {selectedCount} question{selectedCount !== 1 ? "s" : ""} sélectionnée{selectedCount !== 1 ? "s" : ""}
                          </span>
                          <Button
                            size="sm"
                            onClick={openBatchAssignDialog}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Assigner à Phase 1 ({selectedCount})
                          </Button>
                        </div>
                      ) : null;
                    })()}
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <input
                                type="checkbox"
                                checked={
                                  bank.questions.length > 0 &&
                                  bank.questions.every((q) =>
                                    getSelectedQuestionsForBank(bank.id).has(q.id)
                                  )
                                }
                                onChange={() =>
                                  toggleAllQuestionsInBank(
                                    bank.id,
                                    bank.questions.map((q) => q.id)
                                  )
                                }
                                title="Select all"
                              />
                            </TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Options</TableHead>
                            <TableHead>Réponse correcte</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bank.questions.map((question) => {
                            const isSelected = getSelectedQuestionsForBank(bank.id).has(question.id);
                            return (
                              <TableRow key={question.id} className={isSelected ? "bg-muted/50" : ""}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleQuestionSelection(bank.id, question.id)}
                                  />
                                </TableCell>
                                <TableCell className="max-w-md">
                                  <p className="line-clamp-2">{question.question}</p>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {Object.entries(question.options).map(([key, value]) => (
                                      <div key={key} className="text-sm">
                                        <span className="font-medium">{key}:</span> {value}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="default">{question.correctAnswer}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openAssignSingleQuestionDialog(question.id)}
                                      title="Assign to Phase 1"
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditQuestionDialog(question)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
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
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedBankId ? "Edit question bank" : "Create question bank"}
            </DialogTitle>
            <DialogDescription>
              Créez une banque de questions pour la Phase 3 (Pratique). Les questions seront servies aléatoirement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formState.title}
                onChange={(e) =>
                  setFormState({ ...formState, title: e.target.value })
                }
                placeholder="Ex: Questions Chapter 1 to 3"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formState.description}
                onChange={(e) =>
                  setFormState({ ...formState, description: e.target.value })
                }
                placeholder="Description de la banque de questions..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Module (optionnel)</Label>
              <Select
                value={formState.moduleId || "none"}
                onValueChange={(value) =>
                  setFormState({ ...formState, moduleId: value === "none" ? null : value })
                }
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
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                {selectedBankId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={questionEditDialogOpen} onOpenChange={setQuestionEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la question</DialogTitle>
            <DialogDescription>
              Modifiez la question, les options et la réponse correcte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Question *</Label>
              <Textarea
                value={questionFormState.question}
                onChange={(e) =>
                  setQuestionFormState({ ...questionFormState, question: e.target.value })
                }
                placeholder="Entrez la question..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Option A *</Label>
                <Input
                  value={questionFormState.optionA}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionA: e.target.value })
                  }
                  placeholder="Option A"
                />
              </div>
              <div className="space-y-2">
                <Label>Option B *</Label>
                <Input
                  value={questionFormState.optionB}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionB: e.target.value })
                  }
                  placeholder="Option B"
                />
              </div>
              <div className="space-y-2">
                <Label>Option C (optionnel)</Label>
                <Input
                  value={questionFormState.optionC}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionC: e.target.value })
                  }
                  placeholder="Option C"
                />
              </div>
              <div className="space-y-2">
                <Label>Option D (optionnel)</Label>
                <Input
                  value={questionFormState.optionD}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionD: e.target.value })
                  }
                  placeholder="Option D"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Réponse correcte *</Label>
              <Select
                value={
                  questionFormState.correctAnswer &&
                  (questionFormState.optionA || questionFormState.optionB || 
                   questionFormState.optionC || questionFormState.optionD)
                    ? questionFormState.correctAnswer
                    : questionFormState.optionA
                    ? "A"
                    : questionFormState.optionB
                    ? "B"
                    : "A"
                }
                onValueChange={(value) =>
                  setQuestionFormState({ ...questionFormState, correctAnswer: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionFormState.optionA && <SelectItem value="A">A</SelectItem>}
                  {questionFormState.optionB && <SelectItem value="B">B</SelectItem>}
                  {questionFormState.optionC && <SelectItem value="C">C</SelectItem>}
                  {questionFormState.optionD && <SelectItem value="D">D</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Explication (optionnel)</Label>
              <Textarea
                value={questionFormState.explanation}
                onChange={(e) =>
                  setQuestionFormState({ ...questionFormState, explanation: e.target.value })
                }
                placeholder="Explanation of the correct answer..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setQuestionEditDialogOpen(false);
                setEditingQuestion(null);
              }}>
                Annuler
              </Button>
              <Button onClick={handleUpdateQuestion}>
                Mettre à jour
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign to Phase 1 Dialog */}
      <Dialog open={assignToPhase1DialogOpen} onOpenChange={(open) => {
        setAssignToPhase1DialogOpen(open);
        if (!open) {
          setSelectedBankId(null);
          setSelectedQuizId("");
          setSelectedQuestionIds(new Set());
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assigner des questions à un quiz Phase 1</DialogTitle>
            <DialogDescription>
              Sélectionnez un quiz Phase 1 et les questions à assigner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Quiz Phase 1 *</Label>
              <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quiz" />
                </SelectTrigger>
                <SelectContent>
                  {phase1Quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {quiz.title} ({quiz.moduleTitle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {phase1Quizzes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun quiz Phase 1 trouvé. Créez d'abord un quiz dans un module.
                </p>
              )}
            </div>

            {selectedBankId && (
              <>
                <div className="space-y-2">
                  <Label>Questions à assigner</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const bank = questionBanks.find(b => b.id === selectedBankId);
                        if (bank) {
                          const allIds = new Set(bank.questions.map(q => q.id));
                          setSelectedQuestionIds(allIds);
                        }
                      }}
                    >
                      Sélectionner tout
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQuestionIds(new Set())}
                    >
                      Désélectionner tout
                    </Button>
                  </div>
                </div>

                {(() => {
                  const bank = questionBanks.find(b => b.id === selectedBankId);
                  if (!bank || bank.questions.length === 0) return null;

                  return (
                    <div className="border rounded-md max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <input
                                type="checkbox"
                                checked={selectedQuestionIds.size === bank.questions.length && bank.questions.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQuestionIds(new Set(bank.questions.map(q => q.id)));
                                  } else {
                                    setSelectedQuestionIds(new Set());
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Réponse</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bank.questions.map((question) => (
                            <TableRow key={question.id}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedQuestionIds.has(question.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedQuestionIds);
                                    if (e.target.checked) {
                                      newSet.add(question.id);
                                    } else {
                                      newSet.delete(question.id);
                                    }
                                    setSelectedQuestionIds(newSet);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="max-w-md">
                                <p className="line-clamp-2 text-sm">{question.question}</p>
                              </TableCell>
                              <TableCell>
                                <Badge>{question.correctAnswer}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAssignToPhase1DialogOpen(false);
                      setSelectedBankId(null);
                      setSelectedQuizId("");
                      setSelectedQuestionIds(new Set());
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => selectedBankId && handleAssignToPhase1(selectedBankId, false)}
                    disabled={!selectedQuizId || selectedQuestionIds.size === 0 || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ajout en cours...
                      </>
                    ) : (
                      `Assigner ${selectedQuestionIds.size} question(s)`
                    )}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => selectedBankId && handleAssignToPhase1(selectedBankId, true)}
                    disabled={!selectedQuizId || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ajout en cours...
                      </>
                    ) : (
                      "Assigner toutes les questions"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Assign Questions to Phase 1 Dialog */}
      <Dialog open={batchAssignDialogOpen} onOpenChange={(open) => {
        setBatchAssignDialogOpen(open);
        if (!open) {
          setSelectedQuizId("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner les questions sélectionnées à un quiz Phase 1</DialogTitle>
            <DialogDescription>
              {getAllSelectedQuestions().length} question{getAllSelectedQuestions().length !== 1 ? "s" : ""} sélectionnée{getAllSelectedQuestions().length !== 1 ? "s" : ""}. Sélectionnez un quiz Phase 1 pour les assigner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Quiz Phase 1 *</Label>
              <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quiz" />
                </SelectTrigger>
                <SelectContent>
                  {phase1Quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {quiz.title} ({quiz.moduleTitle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {phase1Quizzes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun quiz Phase 1 trouvé. Créez d'abord un quiz dans un module.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setBatchAssignDialogOpen(false);
                  setSelectedQuizId("");
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleBatchAssign}
                disabled={!selectedQuizId || getAllSelectedQuestions().length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  `Assigner ${getAllSelectedQuestions().length} question(s)`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Single Question to Phase 1 Dialog */}
      <Dialog open={assignSingleQuestionDialogOpen} onOpenChange={(open) => {
        setAssignSingleQuestionDialogOpen(open);
        if (!open) {
          setSingleQuestionId("");
          setSelectedQuizId("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner la question à un quiz Phase 1</DialogTitle>
            <DialogDescription>
              Sélectionnez un quiz Phase 1 pour assigner cette question.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Quiz Phase 1 *</Label>
              <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a quiz" />
                </SelectTrigger>
                <SelectContent>
                  {phase1Quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {quiz.title} ({quiz.moduleTitle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {phase1Quizzes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun quiz Phase 1 trouvé. Créez d'abord un quiz dans un module.
                </p>
              )}
            </div>

            {singleQuestionId && (() => {
              // Find the question to show preview
              let question = null;
              for (const bank of questionBanks) {
                question = bank.questions.find(q => q.id === singleQuestionId);
                if (question) break;
              }

              if (question) {
                return (
                  <div className="border rounded-md p-4 space-y-2">
                    <p className="text-sm font-medium">Question:</p>
                    <p className="text-sm">{question.question}</p>
                    <div className="space-y-1 mt-2">
                      {Object.entries(question.options).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span> {value}
                          {key === question.correctAnswer && (
                            <Badge variant="default" className="ml-2">Correct</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAssignSingleQuestionDialogOpen(false);
                  setSingleQuestionId("");
                  setSelectedQuizId("");
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAssignSingleQuestion}
                disabled={!selectedQuizId || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  "Assigner la question"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

