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
import { RichTextEditor } from "./rich-text-editor";
import {
  createCourseAction,
  updateCourseAction,
  getCourseCategoriesAction,
} from "@/app/actions/courses";
import { toast } from "sonner";
import type { CourseCategory } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const componentVisibilitySchema = z.object({
  videos: z.boolean().default(true),
  quizzes: z.boolean().default(true),
  flashcards: z.boolean().default(true),
  notes: z.boolean().default(true),
  messaging: z.boolean().default(true),
  appointments: z.boolean().default(true),
  virtualTutor: z.boolean().default(false),
  caseStudies: z.boolean().default(false),
});

// Form schema (keep inputs as strings for react-hook-form)
const courseFormSchema = z.object({
  code: z.string().optional().nullable(),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  price: z.string().min(1, "Le prix est requis"),
  accessDuration: z.string().min(1, "The access duration is required"),
  paymentType: z.enum(["ONE_TIME", "SUBSCRIPTION"]),
  categoryId: z.string().min(1, "Category is required"),
  published: z.boolean().default(false),
  componentVisibility: componentVisibilitySchema.optional(),
  appointmentHourlyRate: z.string().optional(),
  recommendedStudyHoursMin: z.string().optional(),
  recommendedStudyHoursMax: z.string().optional(),
  orientationVideoUrl: z.string().optional().nullable(),
  orientationText: z.string().optional().nullable(),
  heroImages: z.string().optional(),
  displayOrder: z.string().optional(),
});

// Submit schema (transform strings -> typed values for server actions)
const courseSubmitSchema = courseFormSchema.extend({
  price: z.string().transform((val) => parseFloat(val)),
  accessDuration: z.string().transform((val) => parseInt(val, 10)),
  appointmentHourlyRate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== "" ? parseFloat(val) : null)),
  recommendedStudyHoursMin: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : null)),
  recommendedStudyHoursMax: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : null)),
  displayOrder: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== "" ? parseInt(val, 10) : null)),
  heroImages: z.string().optional().transform((val) => {
    if (!val || val.trim() === "") return [];
    // Split by newline or comma, trim each, and filter empty strings
    return val.split(/[,\n]/).map((url) => url.trim()).filter((url) => url.length > 0);
  }),
});

type CourseFormData = z.infer<typeof courseSubmitSchema>;
type CourseFormValues = z.input<typeof courseFormSchema>;

interface CourseFormProps {
  courseId?: string;
  initialData?: Partial<CourseFormData & { description: string; componentVisibility?: any; heroImages?: string[] }>;
}

export function CourseForm({ courseId, initialData }: CourseFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState(initialData?.description || "");
  const [orientationText, setOrientationText] = useState((initialData as any)?.orientationText || "");
  const [componentVisibility, setComponentVisibility] = useState({
    videos: initialData?.componentVisibility?.videos ?? true,
    quizzes: initialData?.componentVisibility?.quizzes ?? true,
    flashcards: initialData?.componentVisibility?.flashcards ?? true,
    notes: initialData?.componentVisibility?.notes ?? true,
    messaging: initialData?.componentVisibility?.messaging ?? true,
    appointments: initialData?.componentVisibility?.appointments ?? true,
    virtualTutor: initialData?.componentVisibility?.virtualTutor ?? false,
    caseStudies: initialData?.componentVisibility?.caseStudies ?? false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      code: (initialData as any)?.code || "",
      title: initialData?.title || "",
      price: initialData?.price?.toString() || "0",
      accessDuration: initialData?.accessDuration?.toString() || "365",
      paymentType: initialData?.paymentType || "ONE_TIME",
      categoryId: initialData?.categoryId || "",
      published: initialData?.published || false,
      appointmentHourlyRate: (initialData as any)?.appointmentHourlyRate?.toString() || "",
      recommendedStudyHoursMin: (initialData as any)?.recommendedStudyHoursMin?.toString() || "6",
      recommendedStudyHoursMax: (initialData as any)?.recommendedStudyHoursMax?.toString() || "10",
      orientationVideoUrl: (initialData as any)?.orientationVideoUrl || "",
      orientationText: (initialData as any)?.orientationText || "",
      heroImages: Array.isArray((initialData as any)?.heroImages) 
        ? (initialData as any).heroImages.join("\n") 
        : "",
      displayOrder: (initialData as any)?.displayOrder?.toString() || "",
    },
  });

  const paymentType = watch("paymentType");
  const published = watch("published");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCourseCategoriesAction();
        setCategories(cats);
      } catch (error) {
        toast.error("Error loading categories");
      }
    };
    loadCategories();
  }, []);

  const onSubmit = async (values: CourseFormValues) => {
    try {
      setLoading(true);
      const data = courseSubmitSchema.parse(values);

      const courseData = {
        ...data,
        description: description || undefined,
        componentVisibility,
        orientationVideoUrl: data.orientationVideoUrl ?? null,
        orientationText: orientationText || null,
      };

      let result;
      if (courseId) {
        result = await updateCourseAction(courseId, courseData);
      } else {
        result = await createCourseAction(courseData);
      }

      if (result.success) {
        toast.success(
          courseId ? "Course updated successfully" : "Course created successfully"
        );
        router.push("/dashboard/admin?tab=courses");
        router.refresh();
      } else {
        console.error("Course update/create error:", result.error);
        toast.error(result.error || "An error occurred");
      }
    } catch (error) {
      console.error("Course form submission error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Une erreur est survenue: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code du cours</Label>
          <Input
            id="code"
            {...register("code")}
            placeholder="Ex: FIN-101"
          />
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Titre du cours *</Label>
          <Input
            id="title"
            {...register("title")}
            placeholder="Ex: Introduction to finance"
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Catégorie *</Label>
          <Select
            value={watch("categoryId")}
            onValueChange={(value) => setValue("categoryId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && (
            <p className="text-sm text-destructive">{errors.categoryId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Describe your course..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
          <Label htmlFor="displayOrder">Ordre d'affichage</Label>
          <Input
            id="displayOrder"
            type="number"
            min="0"
            {...register("displayOrder")}
            placeholder="Optional (lower = displayed first)"
          />
          <p className="text-xs text-muted-foreground">
            Numéro pour ordonner les cours sur la page /courses (optionnel, plus bas = affiché en premier)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointmentHourlyRate">Tarif horaire pour rendez-vous ($)</Label>
          <Input
            id="appointmentHourlyRate"
            type="number"
            step="0.01"
            min="0"
            {...register("appointmentHourlyRate")}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">
            Tarif horaire pour les rendez-vous avec instructeur (optionnel)
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recommendedStudyHoursMin">Heures d'étude recommandées (min)</Label>
          <Input
            id="recommendedStudyHoursMin"
            type="number"
            min="1"
            max="40"
            {...register("recommendedStudyHoursMin")}
            placeholder="6"
          />
          <p className="text-xs text-muted-foreground">
            Nombre minimum d'heures d'étude par semaine recommandé (pour cours professionnels)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recommendedStudyHoursMax">Heures d'étude recommandées (max)</Label>
          <Input
            id="recommendedStudyHoursMax"
            type="number"
            min="1"
            max="40"
            {...register("recommendedStudyHoursMax")}
            placeholder="10"
          />
          <p className="text-xs text-muted-foreground">
            Nombre maximum d'heures d'étude par semaine recommandé (pour cours professionnels)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentType">Type de paiement *</Label>
          <Select
            value={paymentType}
            onValueChange={(value: "ONE_TIME" | "SUBSCRIPTION") =>
              setValue("paymentType", value)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONE_TIME">Paiement unique</SelectItem>
              <SelectItem value="SUBSCRIPTION">Abonnement</SelectItem>
            </SelectContent>
          </Select>
          {errors.paymentType && (
            <p className="text-sm text-destructive">{errors.paymentType.message}</p>
          )}
        </div>
      </div>

      {/* Orientation Video URL (for Phase 0) */}
      <div className="space-y-2">
        <Label htmlFor="orientationVideoUrl">URL de la vidéo d'orientation (Vimeo)</Label>
        <Input
          id="orientationVideoUrl"
          {...register("orientationVideoUrl")}
          placeholder="https://vimeo.com/123456789"
          type="url"
        />
        <p className="text-xs text-muted-foreground">
          URL Vimeo de la vidéo d'orientation (5-10 minutes) qui sera montrée aux étudiants lors de la Phase 0. Si aucune URL n'est fournie, le texte d'orientation ci-dessous sera affiché à la place.
        </p>
        {errors.orientationVideoUrl && (
          <p className="text-sm text-destructive">{errors.orientationVideoUrl.message}</p>
        )}
      </div>

      {/* Orientation Text (for Phase 0 when no video) */}
      <div className="space-y-2">
        <Label htmlFor="orientationText">Texte d'orientation (Phase 0)</Label>
        <RichTextEditor
          content={orientationText}
          onChange={setOrientationText}
          placeholder="Explanatory text for Phase 0 (displayed if no video is provided)..."
        />
        <p className="text-xs text-muted-foreground">
          Texte d'explication affiché aux étudiants lors de la Phase 0 si aucune vidéo d'orientation n'est fournie. Utilisez ce champ pour expliquer le format de l'examen, la note de passage, et comment utiliser la plateforme.
        </p>
      </div>

      {/* Hero Images */}
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

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setValue("published", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="published" className="cursor-pointer">
          Publier le cours
        </Label>
      </div>

      {/* Component Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Visibilité des composants</CardTitle>
          <CardDescription>
            Contrôlez quels composants sont visibles pour les étudiants dans ce cours
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
            <div className="flex items-center justify-between">
              <Label htmlFor="visibility-case-studies" className="cursor-pointer">
                Études de cas
              </Label>
              <Switch
                id="visibility-case-studies"
                checked={componentVisibility.caseStudies}
                onCheckedChange={(checked) =>
                  setComponentVisibility((prev) => ({ ...prev, caseStudies: checked }))
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
            : courseId
            ? "Update"
            : "Create course"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/admin?tab=courses")}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

