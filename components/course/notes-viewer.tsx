"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, FileText, Save, Loader2, Download } from "lucide-react"; // Added Download icon
import { NoteType } from "@prisma/client";

interface NotesViewerProps {
  contentItemId: string;
  coursePdfUrl?: string | null;
  modulePdfUrl?: string | null;
}

export function NotesViewer({ contentItemId, coursePdfUrl, modulePdfUrl }: NotesViewerProps) {
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [studentNotes, setStudentNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [contentItemId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      // This would be a server action to get notes
      // For now, we'll use a placeholder
      // TODO: Create getNotesAction
      setAdminNotes("");
      setStudentNotes("");
    } catch (error) {
      toast.error("Error loading notes");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudentNotes = async () => {
    try {
      setSaving(true);
      // TODO: Create saveStudentNotesAction
      toast.success("Notes saved");
    } catch (error) {
      toast.error("Error saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notes
          </div>
          {modulePdfUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={modulePdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Chapter PDF
              </a>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="admin" className="w-full">
          <TabsList>
            <TabsTrigger value="admin">
              <BookOpen className="h-4 w-4 mr-2" />
              Notes de l'instructeur
            </TabsTrigger>
            <TabsTrigger value="student">
              <FileText className="h-4 w-4 mr-2" />
              Mes notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="mt-4">
            {adminNotes ? (
              <div
                className="tiptap-editor prose max-w-none p-4 bg-muted rounded-md"
                dangerouslySetInnerHTML={{ __html: adminNotes }}
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucune note de l'instructeur disponible
              </p>
            )}
          </TabsContent>

          <TabsContent value="student" className="mt-4 space-y-4">
            <Textarea
              value={studentNotes}
              onChange={(e) => setStudentNotes(e.target.value)}
              placeholder="Ajoutez vos notes personnelles ici..."
              className="min-h-[200px]"
            />
            <Button onClick={handleSaveStudentNotes} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {coursePdfUrl && (
          <div className="mt-8 pt-6 border-t">
            <Button variant="outline" className="w-full" asChild>
              <a href={coursePdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Complete Course PDF
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

