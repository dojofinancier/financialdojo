"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuizQuestion, QuizQuestionType } from "@prisma/client";
import {
  createQuizQuestionAction,
  updateQuizQuestionAction,
  deleteQuizQuestionAction,
  reorderQuizQuestionsAction,
} from "@/app/actions/content-items";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Edit } from "lucide-react";

interface QuizBuilderProps {
  quizId: string;
  questions: QuizQuestion[];
  onChanged: () => void;
}

type EditableQuestion = {
  id?: string;
  type: QuizQuestionType;
  question: string;
  options: { id: string; label: string; value: string }[];
  correctAnswer: string;
};

export function QuizBuilder({ quizId, questions: initialQuestions, onChanged }: QuizBuilderProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const defaultMultipleChoiceOptions = useMemo(
    () => ["A", "B", "C", "D"].map((label) => ({ id: crypto.randomUUID(), label, value: "" })),
    []
  );

  const parseOptions = (data: QuizQuestion["options"]) => {
    if (!data) return defaultMultipleChoiceOptions;
    const record = data as Record<string, string>;
    return Object.entries(record).map(([label, value]) => ({
      id: crypto.randomUUID(),
      label,
      value,
    }));
  };

  const openCreateDialog = () => {
    setEditingQuestion({
      type: "MULTIPLE_CHOICE",
      question: "",
      options: defaultMultipleChoiceOptions,
      correctAnswer: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: QuizQuestion) => {
    setEditingQuestion({
      id: question.id,
      type: question.type,
      question: question.question,
      options: question.type === "MULTIPLE_CHOICE" ? parseOptions(question.options) : defaultMultipleChoiceOptions,
      correctAnswer: question.correctAnswer,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingQuestion(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((question) => question.id === active.id);
    const newIndex = questions.findIndex((question) => question.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);

    const payload = reordered.map((question, index) => ({
      id: question.id,
      order: index,
    }));

    const result = await reorderQuizQuestionsAction(quizId, payload);
    if (!result.success) {
      toast.error(result.error || "Error reordering");
      onChanged();
    } else {
      onChanged();
    }
  };

  const handleDelete = async (questionId: string) => {
    const result = await deleteQuizQuestionAction(questionId);
    if (result.success) {
      toast.success("Question deleted");
      onChanged();
    } else {
      toast.error(result.error || "Error while deleting");
    }
  };

  const handleSave = async () => {
    if (!editingQuestion) return;

    // Validation
    if (!editingQuestion.question.trim()) {
      toast.error("The question prompt is required");
      return;
    }

    if (!editingQuestion.correctAnswer.trim()) {
      toast.error("The correct answer is required");
      return;
    }

    if (editingQuestion.type === "MULTIPLE_CHOICE") {
      const filledOptions = editingQuestion.options.filter((opt) => opt.value.trim());
      if (filledOptions.length === 0) {
        toast.error("At least one answer option is required for multiple-choice questions");
        return;
      }
      if (!filledOptions.some((opt) => opt.label === editingQuestion.correctAnswer)) {
        toast.error("The correct answer must match one of the options");
        return;
      }
    }

    setSaving(true);
    try {
      const optionsRecord =
        editingQuestion.type === "MULTIPLE_CHOICE"
          ? editingQuestion.options.reduce<Record<string, string>>((acc, option) => {
              if (option.value.trim()) {
                acc[option.label] = option.value.trim();
              }
              return acc;
            }, {})
          : null;

      const payload: any = {
        quizId,
        type: editingQuestion.type,
        question: editingQuestion.question.trim(),
        correctAnswer: editingQuestion.correctAnswer.trim(),
        order: editingQuestion.id
          ? questions.findIndex((q) => q.id === editingQuestion.id)
          : questions.length,
      };

      // Only include options if it's MULTIPLE_CHOICE and has values
      if (editingQuestion.type === "MULTIPLE_CHOICE" && optionsRecord && Object.keys(optionsRecord).length > 0) {
        payload.options = optionsRecord;
      }

      if (editingQuestion.id) {
        const result = await updateQuizQuestionAction(editingQuestion.id, payload);
        if (result.success) {
          toast.success("Question updated");
          handleDialogClose(false);
          onChanged();
        } else {
          toast.error(result.error || "Error updating");
        }
      } else {
        const result = await createQuizQuestionAction(payload);
        if (result.success) {
          toast.success("Question created");
          handleDialogClose(false);
          onChanged();
        } else {
          toast.error(result.error || "Error creating");
        }
      }
    } catch (error) {
      toast.error("An error occurred while saving");
      console.error("Error saving question:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateOptionValue = (id: string, value: string) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: editingQuestion.options.map((option) =>
        option.id === id ? { ...option, value } : option
      ),
    });
  };

  const renderQuestionCard = (question: QuizQuestion) => {
    const record = (question.options as Record<string, string>) || {};
    return (
      <div className="space-y-2">
        <p className="font-medium">{question.question}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{question.type}</p>
        {question.type === "MULTIPLE_CHOICE" && (
          <ul className="text-sm text-muted-foreground space-y-1">
            {Object.entries(record).map(([key, value]) => (
              <li key={key}>
                <span className="font-medium">{key}.</span> {value}
              </li>
            ))}
          </ul>
        )}
        {question.type === "TRUE_FALSE" && (
          <p className="text-sm text-muted-foreground">Answer: {question.correctAnswer === "true" ? "True" : "False"}</p>
        )}
        {question.type === "SHORT_ANSWER" && (
          <p className="text-sm text-muted-foreground">Expected answer: {question.correctAnswer}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Questions</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop to reorder questions.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add a question</Button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          No questions yet.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((question) => question.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {questions.map((question) => (
                <SortableQuestionCard
                  key={question.id}
                  question={question}
                  onEdit={() => openEditDialog(question)}
                  onDelete={() => handleDelete(question.id)}
                >
                  {renderQuestionCard(question)}
                </SortableQuestionCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingQuestion?.id ? "Edit the question" : "New question"}</DialogTitle>
            <DialogDescription>
              Configure the prompt, question type, and expected answer.
            </DialogDescription>
          </DialogHeader>

          {editingQuestion && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Question type</Label>
                <Select
                  value={editingQuestion.type}
                  onValueChange={(value: QuizQuestionType) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      type: value,
                      correctAnswer: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MULTIPLE_CHOICE">Multiple choice</SelectItem>
                    <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                    <SelectItem value="SHORT_ANSWER">Short answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prompt</Label>
                <Textarea
                  value={editingQuestion.question}
                  onChange={(event) =>
                    setEditingQuestion({ ...editingQuestion, question: event.target.value })
                  }
                  placeholder="Enter the question here..."
                />
              </div>

              {editingQuestion.type === "MULTIPLE_CHOICE" && (
                <div className="space-y-3">
                  <Label>Answer options</Label>
                  <div className="space-y-2">
                    {editingQuestion.options.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <span className="w-6 text-sm font-medium">{option.label}</span>
                        <Input
                          value={option.value}
                          onChange={(event) => updateOptionValue(option.id, event.target.value)}
                          placeholder={`Answer ${option.label}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Correct answer</Label>
                    <Select
                      value={editingQuestion.correctAnswer}
                      onValueChange={(value) =>
                        setEditingQuestion({ ...editingQuestion, correctAnswer: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {editingQuestion.options
                          .filter((option) => option.value.trim())
                          .map((option) => (
                            <SelectItem key={option.id} value={option.label}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {editingQuestion.type === "TRUE_FALSE" && (
                <div className="space-y-2">
                  <Label>Expected answer</Label>
                  <Select
                    value={editingQuestion.correctAnswer}
                    onValueChange={(value) =>
                      setEditingQuestion({ ...editingQuestion, correctAnswer: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingQuestion.type === "SHORT_ANSWER" && (
                <div className="space-y-2">
                  <Label>Correct answer</Label>
                  <Input
                    value={editingQuestion.correctAnswer}
                    onChange={(event) =>
                      setEditingQuestion({ ...editingQuestion, correctAnswer: event.target.value })
                    }
                    placeholder="Expected answer"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !editingQuestion.question.trim()}>
                  {editingQuestion.id ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableQuestionCardProps {
  question: QuizQuestion;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableQuestionCard({ question, children, onEdit, onDelete }: SortableQuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-4 flex gap-4 items-start"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground mt-1"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-2">{children}</div>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

