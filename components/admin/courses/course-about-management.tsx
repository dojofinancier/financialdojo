"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "./rich-text-editor";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { updateCourseAboutAction } from "@/app/actions/courses";

interface AboutAccordionItem {
  id: string;
  title: string;
  subtitle: string;
  richText: string;
}

interface CourseAboutManagementProps {
  courseId: string;
  initialShortDescription: string;
  initialAboutText: string;
  initialAboutAccordionItems: AboutAccordionItem[];
}

export function CourseAboutManagement({
  courseId,
  initialShortDescription,
  initialAboutText,
  initialAboutAccordionItems,
}: CourseAboutManagementProps) {
  const [shortDescription, setShortDescription] = useState(initialShortDescription || "");
  const [aboutText, setAboutText] = useState(initialAboutText || "");
  const [aboutAccordionItems, setAboutAccordionItems] = useState<AboutAccordionItem[]>(
    Array.isArray(initialAboutAccordionItems) ? initialAboutAccordionItems : []
  );
  const [saving, setSaving] = useState(false);

  const handleAddAccordionItem = () => {
    setAboutAccordionItems([
      ...aboutAccordionItems,
      {
        id: crypto.randomUUID(),
        title: "",
        subtitle: "",
        richText: "",
      },
    ]);
  };

  const handleUpdateAccordionItem = (
    id: string,
    updates: Partial<AboutAccordionItem>
  ) => {
    setAboutAccordionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveAccordionItem = (id: string) => {
    setAboutAccordionItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseAboutAction(courseId, {
        shortDescription,
        aboutText,
        aboutAccordionItems,
      });
      if (result.success) {
        toast.success("Informations mises à jour avec succès");
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Description courte</CardTitle>
          <CardDescription>
            Cette description apparaîtra dans la section héro de la page du cours (2-3 phrases)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="shortDescription">Description courte</Label>
            <Input
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Ex: Préparez-vous efficacement à l'examen CCVM avec notre formation complète..."
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accordéon « Idéal pour les »</CardTitle>
          <CardDescription>
            Ajoutez des éléments avec un titre, un sous-titre et un contenu riche pour la section accordéon sous le héros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aboutAccordionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun élément pour le moment. Ajoutez-en un ci-dessous.
            </p>
          ) : (
            <div className="space-y-6">
              {aboutAccordionItems.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Élément {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAccordionItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`accordion-title-${item.id}`}>Titre</Label>
                      <Input
                        id={`accordion-title-${item.id}`}
                        value={item.title}
                        onChange={(e) => handleUpdateAccordionItem(item.id, { title: e.target.value })}
                        placeholder="Ex: Tests automatisés"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`accordion-subtitle-${item.id}`}>Sous-titre</Label>
                      <Textarea
                        id={`accordion-subtitle-${item.id}`}
                        value={item.subtitle}
                        onChange={(e) => handleUpdateAccordionItem(item.id, { subtitle: e.target.value })}
                        placeholder="Ex: Optimisez vos résultats sans effort"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu riche (boîte de droite)</Label>
                    <RichTextEditor
                      content={item.richText}
                      onChange={(value) => handleUpdateAccordionItem(item.id, { richText: value })}
                      placeholder="Décrivez en détail cet avantage..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleAddAccordionItem}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un élément
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>À propos de la formation</CardTitle>
          <CardDescription>
            Texte détaillé qui apparaîtra dans la section "À propos" de la page du cours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            content={aboutText}
            onChange={setAboutText}
            placeholder="Décrivez en détail votre formation, ses objectifs, sa méthodologie..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
