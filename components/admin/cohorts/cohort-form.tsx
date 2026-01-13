"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "../courses/rich-text-editor";
import {
  createCohortAction,
  updateCohortAction,
  getCohortAction,
  getInstructorsAction,
} from "@/app/actions/cohorts";
import { getCoursesAction } from "@/app/actions/courses";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const componentVisibilitySchema = z.object({
  videos: z.boolean().default(true),
  quizzes: z.boolean().default(true),
  flashcards: z.boolean().default(true),
  notes: z.boolean().default(true),
  messaging: z.boolean().default(true),
  appointments: z.boolean().default(true),
  groupCoaching: z.boolean().default(true),
  messageBoard: z.boolean().default(true),
  virtualTutor: z.boolean().default(false),
});

// Form schema (keeps inputs as strings for react-hook-form)
const cohortFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  slug: z.string().optional().nullable(),
  description: z.string().optional(),
  price: z.string().min(1, "Le prix est requis"),
  maxStudents: z.string().min(1, "Le nombre maximum d'étudiants est requis"),
  enrollmentClosingDate: z.string().min(1, "La date de fin d'inscription est requise"),
  accessDuration: z.string().min(1, "La durée d'accès est requise"),
  published: z.boolean().default(false),
  instructorId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(), // Link to base course
  componentVisibility: componentVisibilitySchema.optional(),
  heroImages: z.string().optional(),
});

// Submit schema (transforms strings -> typed values expected by server actions)
const cohortSubmitSchema = cohortFormSchema.extend({
  price: z.string().transform((val) => parseFloat(val)),
  maxStudents: z.string().transform((val) => parseInt(val, 10)),
  enrollmentClosingDate: z.string().transform((val) => new Date(val)),
  accessDuration: z.string().transform((val) => parseInt(val, 10)),
  heroImages: z.string().optional().transform((val) => {
    if (!val || val.trim() === "") return [];
    // Split by newline or comma, trim each, and filter empty strings
    return val.split(/[,\n]/).map((url) => url.trim()).filter((url) => url.length > 0);
  }),
});

type CohortFormData = z.infer<typeof cohortSubmitSchema>;
type CohortFormValues = z.input<typeof cohortFormSchema>;

interface CohortFormProps {
  cohortId?: string;
  initialData?: Partial<CohortFormData & { description: string; slug?: string | null; componentVisibility?: any; heroImages?: string[] }>;
}

export function CohortForm({ cohortId, initialData }: CohortFormProps) {
  const router = useRouter();
  const [instructors, setInstructors] = useState<Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; code: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState(initialData?.description || "");
  
  // Update description when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData?.description) {
      setDescription(initialData.description);
    }
  }, [initialData?.description]);
  
  const [componentVisibility, setComponentVisibility] = useState({
    videos: initialData?.componentVisibility?.videos ?? true,
    quizzes: initialData?.componentVisibility?.quizzes ?? true,
    flashcards: initialData?.componentVisibility?.flashcards ?? true,
    notes: initialData?.componentVisibility?.notes ?? true,
    messaging: initialData?.componentVisibility?.messaging ?? true,
    appointments: initialData?.componentVisibility?.appointments ?? true,
    groupCoaching: initialData?.componentVisibility?.groupCoaching ?? true,
    messageBoard: initialData?.componentVisibility?.messageBoard ?? true,
    virtualTutor: initialData?.componentVisibility?.virtualTutor ?? false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CohortFormValues>({
    resolver: zodResolver(cohortFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      slug: initialData?.slug || "",
      price: initialData?.price?.toString() || "0",
      maxStudents: initialData?.maxStudents?.toString() || "20",
      enrollmentClosingDate: initialData?.enrollmentClosingDate
        ? new Date(initialData.enrollmentClosingDate).toISOString().split("T")[0]
        : "",
      accessDuration: initialData?.accessDuration?.toString() || "365",
      published: initialData?.published || false,
      instructorId: initialData?.instructorId || null,
      courseId: initialData?.courseId || null,
      heroImages: Array.isArray((initialData as any)?.heroImages) 
        ? (initialData as any).heroImages.join("\n") 
        : "",
    },
  });

  const published = watch("published");

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load instructors
        const instructorsResult = await getInstructorsAction();
        if (instructorsResult.success && instructorsResult.data) {
          setInstructors(instructorsResult.data);
        }
        
        // Load courses - getCoursesAction returns { items, nextCursor, hasMore }
        try {
          const coursesResult = await getCoursesAction({ limit: 1000 });
          console.log("Courses result:", coursesResult);
          if (coursesResult && Array.isArray(coursesResult.items)) {
            if (coursesResult.items.length > 0) {
              setCourses(coursesResult.items);
              console.log("Loaded courses:", coursesResult.items.length);
            } else {
              console.warn("No courses found in database");
            }
          } else {
            console.error("Invalid courses result format:", coursesResult);
          }
        } catch (courseError) {
          console.error("Error loading courses:", courseError);
          // Show error to user
          toast.error("Erreur lors du chargement des formations");
        }
      } catch (error) {
        console.error("Error loading data:", error);
        // Continue without data - admin can still create cohort
      }
    };
    loadData();
  }, []);

  const onSubmit = async (values: CohortFormValues) => {
    try {
      setLoading(true);
      const data = cohortSubmitSchema.parse(values);

      const cohortData = {
        ...data,
        description: description || undefined,
        componentVisibility,
        heroImages: data.heroImages || [],
        features: [],
        testimonials: [],
        instructorId: data.instructorId === "" || data.instructorId === "none" ? null : data.instructorId,
        courseId: data.courseId === "" || data.courseId === "none" ? null : data.courseId,
      };

      let result;
      if (cohortId) {
        result = await updateCohortAction(cohortId, cohortData);
      } else {
        result = await createCohortAction(cohortData);
      }

      if (result.success) {
        toast.success(
          cohortId ? "Cohorte mise à jour avec succès" : "Cohorte créée avec succès"
        );
        if (cohortId) {
          // Stay on the edit page when updating - refresh to show updated data
          window.location.reload();
        } else {
          // Go to cohorts list when creating new
          router.push("/tableau-de-bord/admin/cohorts");
        }
      } else {
        console.error("Cohort update/create error:", result.error);
        toast.error(result.error || "Une erreur est survenue");
      }
    } catch (error) {
      console.error("Cohort form submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Une erreur est survenue: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      <div className="space-y-2">
        <Label htmlFor="title">Titre de la cohorte *</Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="Ex: Cohorte Finance Avancée - Janvier 2025"
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL) *</Label>
        <Input
          id="slug"
          {...register("slug")}
          placeholder="cohorte-finance-avancee-janvier-2025"
        />
        <p className="text-xs text-muted-foreground">
          Laissez vide pour générer automatiquement à partir du titre. Utilisé dans l'URL: /cohorte/[slug]
        </p>
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Décrivez votre cohorte..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="heroImages">Images héro (URLs des captures d'écran)</Label>
        <Textarea
          id="heroImages"
          {...register("heroImages")}
          placeholder="/screenshots1.png&#10;/screenshots2.png"
          rows={3}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Entrez les URLs des images (une par ligne ou séparées par des virgules). Exemple: /screenshots1.png ou https://example.com/image.png. La première image sera affichée sur la page produit.
        </p>
        {errors.heroImages && (
          <p className="text-sm text-destructive">{errors.heroImages.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Prix ($) *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            {...register("price")}
            placeholder="0.00"
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxStudents">Nombre maximum d'étudiants *</Label>
          <Input
            id="maxStudents"
            type="number"
            min="1"
            {...register("maxStudents")}
            placeholder="20"
          />
          {errors.maxStudents && (
            <p className="text-sm text-destructive">{errors.maxStudents.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="enrollmentClosingDate">Date limite d'inscription *</Label>
          <Input
            id="enrollmentClosingDate"
            type="date"
            {...register("enrollmentClosingDate")}
          />
          {errors.enrollmentClosingDate && (
            <p className="text-sm text-destructive">
              {errors.enrollmentClosingDate.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessDuration">Durée d'accès (jours) *</Label>
          <Input
            id="accessDuration"
            type="number"
            min="1"
            {...register("accessDuration")}
            placeholder="365"
          />
          {errors.accessDuration && (
            <p className="text-sm text-destructive">
              {errors.accessDuration.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructorId">Instructeur</Label>
          <Select
            value={watch("instructorId") || "none"}
            onValueChange={(value) => setValue("instructorId", value === "none" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un instructeur (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun instructeur</SelectItem>
              {instructors.map((instructor) => (
                <SelectItem key={instructor.id} value={instructor.id}>
                  {instructor.firstName || instructor.lastName
                    ? `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim()
                    : instructor.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="courseId">Formation de base (optionnel)</Label>
          <Select
            value={watch("courseId") || "none"}
            onValueChange={(value) => setValue("courseId", value === "none" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une formation (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune formation</SelectItem>
              {courses.length === 0 ? (
                <SelectItem value="loading" disabled>
                  Chargement des formations...
                </SelectItem>
              ) : (
                courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code ? `${course.code} - ${course.title}` : course.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Si sélectionné, tous les modules de cette formation seront automatiquement ajoutés à la cohorte
            {courses.length > 0 && ` (${courses.length} formation${courses.length > 1 ? 's' : ''} disponible${courses.length > 1 ? 's' : ''})`}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setValue("published", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="published" className="cursor-pointer">
          Publier la cohorte
        </Label>
      </div>

      {/* Component Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Visibilité des composants</CardTitle>
          <CardDescription>
            Contrôlez quels composants sont visibles pour les étudiants dans cette cohorte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-videos" className="cursor-pointer">
                Vidéos
              </Label>
              <Switch
                id="visibility-videos"
                checked={componentVisibility.videos}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, videos: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-quizzes" className="cursor-pointer">
                Quiz et examens
              </Label>
              <Switch
                id="visibility-quizzes"
                checked={componentVisibility.quizzes}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, quizzes: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-flashcards" className="cursor-pointer">
                Flashcards
              </Label>
              <Switch
                id="visibility-flashcards"
                checked={componentVisibility.flashcards}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, flashcards: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-notes" className="cursor-pointer">
                Notes
              </Label>
              <Switch
                id="visibility-notes"
                checked={componentVisibility.notes}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, notes: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-messaging" className="cursor-pointer">
                Messagerie
              </Label>
              <Switch
                id="visibility-messaging"
                checked={componentVisibility.messaging}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, messaging: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-appointments" className="cursor-pointer">
                Rendez-vous
              </Label>
              <Switch
                id="visibility-appointments"
                checked={componentVisibility.appointments}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, appointments: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-group-coaching" className="cursor-pointer">
                Coachings de groupe
              </Label>
              <Switch
                id="visibility-group-coaching"
                checked={componentVisibility.groupCoaching}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, groupCoaching: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-message-board" className="cursor-pointer">
                Tableau de messages
              </Label>
              <Switch
                id="visibility-message-board"
                checked={componentVisibility.messageBoard}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, messageBoard: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-virtual-tutor" className="cursor-pointer">
                Tuteur virtuel (v2)
              </Label>
              <Switch
                id="visibility-virtual-tutor"
                checked={componentVisibility.virtualTutor}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, virtualTutor: checked }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Enregistrement..."
            : cohortId
            ? "Mettre à jour"
            : "Créer la cohorte"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (cohortId) {
              router.back();
            } else {
              router.push("/tableau-de-bord/admin/cohorts");
            }
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

