"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadQuizCSVAction, uploadFlashcardCSVAction } from "@/app/actions/csv-upload";
import { getModulesAction } from "@/app/actions/modules";
import { toast } from "sonner";
import { Upload, Loader2, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVUploadDialogProps {
  courseId: string;
  type: "quiz" | "exam" | "flashcard";
  onSuccess?: () => void;
}

export function CSVUploadDialog({ courseId, type, onSuccess }: CSVUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadModules = async () => {
    try {
      const modulesData = await getModulesAction(courseId);
      setModules(modulesData.map((m: any) => ({ id: m.id, title: m.title })));
      if (modulesData.length > 0) {
        setModuleId(modulesData[0].id);
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    if (type !== "flashcard" && !moduleId) {
      toast.error("Please select a module");
      return;
    }

    setUploading(true);
    try {
      const fileContent = await file.text();
      let result;

      if (type === "flashcard") {
        result = await uploadFlashcardCSVAction(courseId, fileContent);
      } else {
        result = await uploadQuizCSVAction(courseId, moduleId, fileContent, type === "exam");
      }

      if (result.success) {
        const data = result.data;
        if (type === "flashcard" && data?.flashcardsCreated) {
          toast.success(`${data.flashcardsCreated} flashcard${data.flashcardsCreated > 1 ? "s" : ""} created`);
        } else if (data?.quizzesCreated) {
          toast.success(`${data.quizzesCreated} ${type === "exam" ? "exam" : "quiz"} created`);
        }

        if (data?.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} error${data.errors.length > 1 ? "s" : ""} during import`, {
            description: data.errors.slice(0, 3).join(", "),
          });
        }

        setOpen(false);
        setFile(null);
        onSuccess?.();
      } else {
        toast.error(result.error || "Error during upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error reading the file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        loadModules();
      } else {
        setFile(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Import {type === "flashcard" ? "flashcards" : type === "exam" ? "an exam" : "a quiz"} from CSV
          </DialogTitle>
          <DialogDescription>
            {type === "flashcard" ? (
              "Expected format: ID, Title, Question, Answer, Chapter"
            ) : (
              "Expected format: settings, question, answer (Tutor format)"
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {type !== "flashcard" && (
            <div className="space-y-2">
              <Label>Module *</Label>
              <Select value={moduleId || ""} onValueChange={setModuleId}>
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
          )}

          <div className="space-y-2">
            <Label>CSV file *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              {type === "flashcard" ? (
                <>
                  Expected CSV format: columns ID, Title, Question, Answer, Chapter.
                  Flashcards will be created from the file's questions and answers.
                </>
              ) : (
                <>
                  Expected CSV format: first line with settings (title, duration, passing score),
                  then question/answer lines. The format must match the Tutor format.
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading || (type !== "flashcard" && !moduleId)}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


