"use client";

import { useEffect, useState, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, FileText, Edit, Eye, X } from "lucide-react";
import {
  getCaseStudiesAction,
  getCaseStudyAction,
  deleteCaseStudyAction,
  importCaseStudyAction,
  updateCaseStudyAction,
  updateCaseStudyQuestionAction,
  deleteCaseStudyQuestionAction,
} from "@/app/actions/case-studies";

interface CaseStudyManagerProps {
  courseId: string;
}

type CaseStudy = {
  id: string;
  caseId: string;
  caseNumber: number;
  title: string;
  theme: string | null;
  passingScore: number;
  _count: {
    questions: number;
    attempts: number;
  };
};

type CaseStudyQuestion = {
  id: string;
  questionId: string;
  order: number;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string | null;
  questionType: string | null;
  difficulty: string | null;
};

type FullCaseStudy = {
  id: string;
  caseId: string;
  caseNumber: number;
  title: string;
  theme: string | null;
  passingScore: number;
  narrative: any;
  questions: CaseStudyQuestion[];
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

export function CaseStudyManager({ courseId }: CaseStudyManagerProps) {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  
  // Edit states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCaseStudy, setEditingCaseStudy] = useState<FullCaseStudy | null>(null);
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [questionEditDialogOpen, setQuestionEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<CaseStudyQuestion | null>(null);
  
  // Form states
  const [caseStudyFormState, setCaseStudyFormState] = useState({
    title: "",
    theme: "",
    passingScore: 70,
  });
  const [narrativeFormState, setNarrativeFormState] = useState({
    introductionBox: "",
    sections: [] as Array<{
      title: string;
      content: string;
      tables: Array<{ title: string; markdown: string }>;
    }>,
    closing: "",
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

  const loadCaseStudies = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCaseStudiesAction(courseId);
      if (result.success && result.data) {
        setCaseStudies(result.data as CaseStudy[]);
      } else {
        console.error("Case study loading error:", result.error);
        setCaseStudies([]);
        if (result.error) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      console.error("Case study loading exception:", error);
      setCaseStudies([]);
      toast.error("Error loading case studies");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCaseStudies();
  }, [loadCaseStudies]);

  const loadFullCaseStudy = async (caseStudyId: string) => {
    try {
      const result = await getCaseStudyAction(caseStudyId);
      if (result.success && result.data) {
        return result.data as FullCaseStudy;
      }
      return null;
    } catch (error) {
      console.error("Error loading full case study:", error);
      return null;
    }
  };

  const parseNarrativeToForm = (narrative: any) => {
    const caseNarrative = narrative.case_narrative || narrative;
    const sections = (caseNarrative.sections || []).map((section: any) => ({
      title: section.title || "",
      content: section.content || "",
      tables: (section.tables || []).map((table: any) => ({
        title: table.title || "",
        markdown: table.markdown || "",
      })),
    }));

    return {
      introductionBox: caseNarrative.introduction_box || "",
      sections,
      closing: caseNarrative.closing || "",
    };
  };

  const buildNarrativeFromForm = () => {
    return {
      case_narrative: {
        introduction_box: narrativeFormState.introductionBox,
        sections: narrativeFormState.sections.map((section) => ({
          title: section.title,
          content: section.content,
          tables: section.tables.map((table) => ({
            title: table.title,
            markdown: table.markdown,
          })),
        })),
        closing: narrativeFormState.closing,
      },
    };
  };

  const openEditDialog = async (caseStudy: CaseStudy) => {
    const fullCaseStudy = await loadFullCaseStudy(caseStudy.id);
    if (fullCaseStudy) {
      setEditingCaseStudy(fullCaseStudy);
      setCaseStudyFormState({
        title: fullCaseStudy.title,
        theme: fullCaseStudy.theme || "",
        passingScore: fullCaseStudy.passingScore,
      });
      setNarrativeFormState(parseNarrativeToForm(fullCaseStudy.narrative));
      setEditDialogOpen(true);
    }
  };

  const openQuestionsDialog = async (caseStudy: CaseStudy) => {
    const fullCaseStudy = await loadFullCaseStudy(caseStudy.id);
    if (fullCaseStudy) {
      setEditingCaseStudy(fullCaseStudy);
      setQuestionsDialogOpen(true);
    }
  };

  const openQuestionEditDialog = (question: CaseStudyQuestion) => {
    const options = normalizeQuestionOptions(question.options);
    const optionKeys = Object.keys(options).sort();
    
    setEditingQuestion(question);
    setQuestionFormState({
      question: question.question,
      optionA: options[optionKeys[0]] || "",
      optionB: options[optionKeys[1]] || "",
      optionC: options[optionKeys[2]] || "",
      optionD: options[optionKeys[3]] || "",
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || "",
    });
    setQuestionEditDialogOpen(true);
  };

  const handleUpdateCaseStudy = async () => {
    if (!editingCaseStudy) return;

    if (!caseStudyFormState.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    const narrativeData = buildNarrativeFromForm();

    const result = await updateCaseStudyAction(editingCaseStudy.id, {
      title: caseStudyFormState.title.trim(),
      theme: caseStudyFormState.theme.trim() || null,
      passingScore: caseStudyFormState.passingScore,
      narrative: narrativeData,
    });

    if (result.success) {
      toast.success("Case study updated");
      setEditDialogOpen(false);
      await loadCaseStudies();
    } else {
      toast.error(result.error || "Error updating");
    }
  };

  const addSection = () => {
    setNarrativeFormState({
      ...narrativeFormState,
      sections: [
        ...narrativeFormState.sections,
        { title: "", content: "", tables: [] },
      ],
    });
  };

  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...narrativeFormState.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setNarrativeFormState({ ...narrativeFormState, sections: newSections });
  };

  const updateTable = (sectionIndex: number, tableIndex: number, field: "title" | "markdown", value: string) => {
    const newSections = [...narrativeFormState.sections];
    if (!newSections[sectionIndex]) return;
    const newTables = [...(newSections[sectionIndex].tables || [])];
    if (!newTables[tableIndex]) {
      newTables[tableIndex] = { title: "", markdown: "" };
    }
    newTables[tableIndex] = { ...newTables[tableIndex], [field]: value };
    newSections[sectionIndex] = { ...newSections[sectionIndex], tables: newTables };
    setNarrativeFormState({ ...narrativeFormState, sections: newSections });
  };

  const deleteSection = (index: number) => {
    setNarrativeFormState({
      ...narrativeFormState,
      sections: narrativeFormState.sections.filter((_, i) => i !== index),
    });
  };

  const addTable = (sectionIndex: number) => {
    const newSections = [...narrativeFormState.sections];
    if (!newSections[sectionIndex]) return;
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      tables: [...(newSections[sectionIndex].tables || []), { title: "", markdown: "" }],
    };
    setNarrativeFormState({ ...narrativeFormState, sections: newSections });
  };

  const deleteTable = (sectionIndex: number, tableIndex: number) => {
    const newSections = [...narrativeFormState.sections];
    if (!newSections[sectionIndex]) return;
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      tables: newSections[sectionIndex].tables.filter((_, i) => i !== tableIndex),
    };
    setNarrativeFormState({ ...narrativeFormState, sections: newSections });
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !editingCaseStudy) return;

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

    const result = await updateCaseStudyQuestionAction(editingQuestion.id, {
      question: questionFormState.question.trim(),
      options,
      correctAnswer: questionFormState.correctAnswer,
      explanation: questionFormState.explanation.trim() || null,
    });

    if (result.success) {
      toast.success("Question updated");
      setQuestionEditDialogOpen(false);
      setEditingQuestion(null);
      await loadCaseStudies();
      // Reload full case study
      const fullCaseStudy = await loadFullCaseStudy(editingCaseStudy.id);
      if (fullCaseStudy) {
        setEditingCaseStudy(fullCaseStudy);
      }
    } else {
      toast.error(result.error || "Error updating");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    const result = await deleteCaseStudyQuestionAction(questionId);
    if (result.success) {
      toast.success("Question deleted");
      await loadCaseStudies();
      if (editingCaseStudy) {
        const fullCaseStudy = await loadFullCaseStudy(editingCaseStudy.id);
        if (fullCaseStudy) {
          setEditingCaseStudy(fullCaseStudy);
        }
      }
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleDelete = async (caseStudyId: string) => {
    if (!confirm("Are you sure you want to delete this case study?")) {
      return;
    }

    const result = await deleteCaseStudyAction(caseStudyId);
    if (result.success) {
      toast.success("Case study deleted");
      loadCaseStudies();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleImport = async () => {
    const narrativeFile = document.getElementById("narrative-file") as HTMLInputElement;
    const mcqFile = document.getElementById("mcq-file") as HTMLInputElement;

    if (!narrativeFile?.files?.[0] || !mcqFile?.files?.[0]) {
      toast.error("Please select both JSON files (narrative and MCQ)");
      return;
    }

    setImporting(true);
    try {
      const narrativeContent = await narrativeFile.files[0].text();
      const mcqContent = await mcqFile.files[0].text();

      const result = await importCaseStudyAction(courseId, narrativeContent, mcqContent);

      if (result.success) {
        toast.success("Case study imported successfully");
        setImportDialogOpen(false);
        narrativeFile.value = "";
        mcqFile.value = "";
        loadCaseStudies();
      } else {
        toast.error(result.error || "Error during import");
      }
    } catch (error) {
      console.error("Error importing case study:", error);
      toast.error("Error importing files");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading case studies...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Case studies</h2>
          <p className="text-sm text-muted-foreground">
            Manage case studies for Phase 3 (Practice). Each case contains a narrative and 10 multiple-choice questions.
          </p>
        </div>
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Import a case study
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import a case study</DialogTitle>
              <DialogDescription>
                Import a case study from two JSON files: the narrative and the MCQ questions.
                The files must share the same case_id.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="narrative-file">Narrative JSON file *</Label>
                <Input
                  id="narrative-file"
                  type="file"
                  accept=".json"
                  disabled={importing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcq-file">MCQ JSON file *</Label>
                <Input
                  id="mcq-file"
                  type="file"
                  accept=".json"
                  disabled={importing}
                />
              </div>
              {importing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setImportDialogOpen(false)}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Import"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {caseStudies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              No case studies yet.
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Import a case study
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Tentatives</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caseStudies.map((caseStudy) => (
                <TableRow key={caseStudy.id}>
                  <TableCell>
                    <Badge variant="outline">Case {caseStudy.caseNumber}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{caseStudy.title}</TableCell>
                  <TableCell>{caseStudy.theme || "-"}</TableCell>
                  <TableCell>{caseStudy._count.questions}</TableCell>
                  <TableCell>{caseStudy._count.attempts}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openQuestionsDialog(caseStudy)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(caseStudy)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCaseStudy(caseStudy);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Case Study Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>Edit case study</DialogTitle>
            <DialogDescription>
              Edit case study details and narrative.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={caseStudyFormState.title}
                onChange={(e) =>
                  setCaseStudyFormState({ ...caseStudyFormState, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-theme">Theme</Label>
              <Input
                id="edit-theme"
                value={caseStudyFormState.theme}
                onChange={(e) =>
                  setCaseStudyFormState({ ...caseStudyFormState, theme: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-passing-score">Passing score (%)</Label>
              <Input
                id="edit-passing-score"
                type="number"
                min="0"
                max="100"
                value={caseStudyFormState.passingScore}
                onChange={(e) =>
                  setCaseStudyFormState({
                    ...caseStudyFormState,
                    passingScore: parseInt(e.target.value) || 70,
                  })
                }
              />
            </div>
            <div className="space-y-4">
              <Label>Narrative *</Label>
              
              {/* Introduction Box */}
              <div className="space-y-2">
                <Label htmlFor="edit-intro">Introduction box</Label>
                <Textarea
                  id="edit-intro"
                  rows={4}
                  value={narrativeFormState.introductionBox}
                  onChange={(e) =>
                    setNarrativeFormState({
                      ...narrativeFormState,
                      introductionBox: e.target.value,
                    })
                  }
                  placeholder="Case introduction text..."
                />
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sections</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add section
                  </Button>
                </div>
                <div className="space-y-4">
                    {narrativeFormState.sections.map((section, sectionIndex) => (
                      <Card key={sectionIndex}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Section {sectionIndex + 1}
                            </CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSection(sectionIndex)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Section title</Label>
                            <Input
                              value={section.title}
                              onChange={(e) =>
                                updateSection(sectionIndex, "title", e.target.value)
                              }
                              placeholder="Section title..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Content</Label>
                            <Textarea
                              rows={6}
                              value={section.content}
                              onChange={(e) =>
                                updateSection(sectionIndex, "content", e.target.value)
                              }
                              placeholder="Section content..."
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Tables</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addTable(sectionIndex)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                  Add table
                              </Button>
                            </div>
                            {section.tables.map((table, tableIndex) => (
                              <Card key={tableIndex} className="bg-muted">
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">
                                      Table {tableIndex + 1}
                                    </CardTitle>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteTable(sectionIndex, tableIndex)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  <div className="space-y-2">
                                    <Label>Table title</Label>
                                    <Input
                                      value={table.title}
                                      onChange={(e) =>
                                        updateTable(sectionIndex, tableIndex, "title", e.target.value)
                                      }
                                      placeholder="Table title..."
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Markdown content</Label>
                                    <Textarea
                                      rows={4}
                                      className="font-mono text-sm"
                                      value={table.markdown}
                                      onChange={(e) =>
                                        updateTable(sectionIndex, tableIndex, "markdown", e.target.value)
                                      }
                                      placeholder="Table in Markdown format..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Use Markdown table syntax
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {/* Closing */}
              <div className="space-y-2">
                <Label htmlFor="edit-closing">Conclusion</Label>
                <Textarea
                  id="edit-closing"
                  rows={3}
                  value={narrativeFormState.closing}
                  onChange={(e) =>
                    setNarrativeFormState({
                      ...narrativeFormState,
                      closing: e.target.value,
                    })
                  }
                  placeholder="Closing text..."
                />
              </div>
            </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCaseStudy}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Questions - {editingCaseStudy?.title}
            </DialogTitle>
            <DialogDescription>
              Manage questions for this case study. Each case must contain exactly 10 questions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[calc(90vh-180px)]">
              <div className="space-y-4 pr-4">
                {editingCaseStudy?.questions.map((question) => {
                  const options = normalizeQuestionOptions(question.options);
                  const optionKeys = Object.keys(options).sort();
                  
                  return (
                    <Card key={question.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Question {question.order}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openQuestionEditDialog(question)}
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
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="font-medium">{question.question}</p>
                        <div className="space-y-1">
                          {optionKeys.map((key) => (
                            <div
                              key={key}
                              className={`text-sm ${
                                key === question.correctAnswer
                                  ? "font-semibold text-green-600"
                                  : ""
                              }`}
                            >
                              <span className="font-medium">{key}:</span> {options[key]}
                              {key === question.correctAnswer && " ✓"}
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <span className="font-semibold">Explanation:</span> {question.explanation}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setQuestionsDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={questionEditDialogOpen} onOpenChange={setQuestionEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
            <DialogDescription>
              Edit question details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-question-text">Question *</Label>
              <Textarea
                id="edit-question-text"
                value={questionFormState.question}
                onChange={(e) =>
                  setQuestionFormState({ ...questionFormState, question: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-option-a">Option A *</Label>
                <Input
                  id="edit-option-a"
                  value={questionFormState.optionA}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionA: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-option-b">Option B *</Label>
                <Input
                  id="edit-option-b"
                  value={questionFormState.optionB}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionB: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-option-c">Option C</Label>
                <Input
                  id="edit-option-c"
                  value={questionFormState.optionC}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionC: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-option-d">Option D</Label>
                <Input
                  id="edit-option-d"
                  value={questionFormState.optionD}
                  onChange={(e) =>
                    setQuestionFormState({ ...questionFormState, optionD: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-correct-answer">Correct answer *</Label>
              <Select
                value={questionFormState.correctAnswer}
                onValueChange={(value) =>
                  setQuestionFormState({ ...questionFormState, correctAnswer: value })
                }
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
            <div className="space-y-2">
              <Label htmlFor="edit-explanation">Explanation</Label>
              <Textarea
                id="edit-explanation"
                value={questionFormState.explanation}
                onChange={(e) =>
                  setQuestionFormState({ ...questionFormState, explanation: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setQuestionEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateQuestion}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete case study</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this case study? All associated questions and attempts will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedCaseStudy) {
                  handleDelete(selectedCaseStudy.id);
                  setDeleteDialogOpen(false);
                  setSelectedCaseStudy(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
