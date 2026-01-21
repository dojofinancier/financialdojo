"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCourseModulesAction } from "@/app/actions/modules";
import { getBatchModuleContentAction } from "@/app/actions/module-content";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";


interface NoteItem {
  id: string;
  order: number;
  note: {
    id: string;
    content: string;
  };
}

interface ModuleData {
  id: string;
  title: string;
  order: number;
  notes: NoteItem[];
}

interface NotesToolProps {
  courseId: string;
  onBack: () => void;
}

export function NotesTool({ courseId, onBack }: NotesToolProps) {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllModules();
  }, [courseId]);

  useEffect(() => {
    // Reset note index when module changes
    setCurrentNoteIndex(0);
  }, [selectedModuleId]);

  const loadAllModules = async () => {
    try {
      setLoading(true);
      const courseModules = await getCourseModulesAction(courseId);
      
      // Batch load content for all modules with full note data
      const moduleIds = courseModules.map((m) => m.id);
      const batchResult = await getBatchModuleContentAction(moduleIds, true); // includeFullData = true
      
      const modulesWithNotes: ModuleData[] = [];

      if (batchResult.success && batchResult.data) {
        for (const module of courseModules) {
          const moduleContent = batchResult.data[module.id];
          if (moduleContent && moduleContent.notes && moduleContent.notes.length > 0) {
            modulesWithNotes.push({
              id: module.id,
              title: module.title,
              order: module.order,
              notes: moduleContent.notes.map((noteItem: any) => ({
                id: noteItem.id,
                order: noteItem.order,
                note: noteItem.note, // Full note data already included
              })),
            });
          }
        }
      }

      // Sort by module order
      modulesWithNotes.sort((a, b) => a.order - b.order);

      setModules(modulesWithNotes);
      
      // Auto-select first module if available
      if (modulesWithNotes.length > 0) {
        setSelectedModuleId(modulesWithNotes[0].id);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedModule = modules.find((m) => m.id === selectedModuleId);
  const currentNote = selectedModule?.notes[currentNoteIndex];
  const currentModuleIndex = modules.findIndex((m) => m.id === selectedModuleId);

  const handlePreviousNote = () => {
    if (currentNoteIndex > 0) {
      setCurrentNoteIndex(currentNoteIndex - 1);
    } else if (currentModuleIndex > 0) {
      // Move to previous module's last note
      const prevModule = modules[currentModuleIndex - 1];
      setSelectedModuleId(prevModule.id);
      setCurrentNoteIndex(prevModule.notes.length - 1);
    }
  };

  const handleNextNote = () => {
    if (selectedModule && currentNoteIndex < selectedModule.notes.length - 1) {
      setCurrentNoteIndex(currentNoteIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
      // Move to next module's first note
      const nextModule = modules[currentModuleIndex + 1];
      setSelectedModuleId(nextModule.id);
      setCurrentNoteIndex(0);
    }
  };

  const canGoPrevious = currentNoteIndex > 0 || currentModuleIndex > 0;
  const canGoNext = 
    (selectedModule && currentNoteIndex < selectedModule.notes.length - 1) ||
    currentModuleIndex < modules.length - 1;

  const handleDownloadPdf = () => {
    if (!currentNote || !selectedModule) return;

    const title = `${selectedModule.title} - Note ${currentNoteIndex + 1}`;
    const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: "Inter", Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 20px; margin-bottom: 16px; }
      .note-content { line-height: 1.75; }
      .note-content p { margin: 0 0 16px 0; }
      .note-content h1 { font-size: 24px; margin: 24px 0 16px; }
      .note-content h2 { font-size: 20px; margin: 20px 0 12px; }
      .note-content h3 { font-size: 18px; margin: 16px 0 10px; }
      .note-content ul, .note-content ol { margin: 16px 0; padding-left: 24px; }
      .note-content li { margin-bottom: 8px; }
      @media print { body { margin: 0.5in; } }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="note-content">${currentNote.note.content}</div>
  </body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.srcdoc = html;

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) return;
      printWindow.focus();
      printWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    };

    document.body.appendChild(iframe);
  };


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucune note disponible pour ce cours.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-3">
          <Select value={selectedModuleId || ""} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id}>
                  Module {module.order + 1}: {module.title} ({module.notes.length} note{module.notes.length > 1 ? 's' : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="hidden md:inline-flex"
            onClick={handleDownloadPdf}
            disabled={!currentNote}
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
        </div>

      </div>

      {selectedModule && currentNote && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedModule.title}
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-2">
              Note {currentNoteIndex + 1} / {selectedModule.notes.length}
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="note-content [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:my-4 [&>ol]:my-4 [&>li]:mb-2 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-6 [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-4 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-3 [&>strong]:font-semibold [&>em]:italic [&>a]:text-primary [&>a]:underline [&>a:hover]:no-underline [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>li]:ml-4"
              style={{ lineHeight: '1.75' }}
              dangerouslySetInnerHTML={{ __html: currentNote.note.content }}
            />
          </CardContent>
          <div className="flex items-center justify-between pt-4 border-t px-6 pb-6">
            <Button
              variant="outline"
              onClick={handlePreviousNote}
              disabled={!canGoPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Précédent
            </Button>
            <Button
              variant="outline"
              onClick={handleNextNote}
              disabled={!canGoNext}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
