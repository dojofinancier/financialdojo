"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, AlertCircle, Loader2, Settings } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { initializeCourseSettingsAction } from "@/app/actions/study-plan";
import { toast } from "sonner";
import type { SelfRating } from "@prisma/client";
import { useCourseSettings } from "@/lib/hooks/use-course-settings";

interface StudyPlanSettingsProps {
  courseId: string;
  courseTitle: string;
  recommendedStudyHoursMin?: number | null;
  recommendedStudyHoursMax?: number | null;
  onUpdate?: () => void;
}

export function StudyPlanSettings({
  courseId,
  courseTitle,
  recommendedStudyHoursMin = 6,
  recommendedStudyHoursMax = 10,
  onUpdate,
}: StudyPlanSettingsProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const queryClient = useQueryClient();
  const [examDate, setExamDate] = useState<Date | undefined>(undefined);
  const [studyHoursPerWeek, setStudyHoursPerWeek] = useState(6);
  const [selfRating, setSelfRating] = useState<SelfRating>("NOVICE");
  const [preferredStudyDays, setPreferredStudyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Use React Query for course settings - automatic caching and deduplication
  const { data: settings, isLoading: loadingSettings } = useCourseSettings(courseId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(0);
      return;
    }

    setLoadingProgress(10);
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + increment, 90);
      });
    }, 700);

    return () => clearInterval(interval);
  }, [loading]);

  const applySettings = (nextSettings: any) => {
    if (!nextSettings) return;
    setExamDate(nextSettings.examDate ? new Date(nextSettings.examDate) : undefined);
    setStudyHoursPerWeek(nextSettings.studyHoursPerWeek || 6);
    setSelfRating(nextSettings.selfRating || "NOVICE");
    setPreferredStudyDays((nextSettings.preferredStudyDays as number[]) || [1, 2, 3, 4, 5]);
  };

  // Load settings into local state when dialog opens or settings change
  useEffect(() => {
    if (!open) return;
    applySettings(settings);
  }, [open, settings]);

  const handleDayToggle = (day: number) => {
    setPreferredStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!examDate) {
      setError("Please select an exam date");
      return;
    }

    if (examDate <= new Date()) {
      setError("The exam date must be in the future");
      return;
    }

    if (studyHoursPerWeek < 1 || studyHoursPerWeek > 40) {
      setError("The number of hours per week must be between 1 and 40");
      return;
    }

    if (preferredStudyDays.length === 0) {
      setError("Please select at least one study day");
      return;
    }

    setLoading(true);

    try {
      const result = await initializeCourseSettingsAction(courseId, {
        examDate,
        studyHoursPerWeek,
        preferredStudyDays,
        selfRating,
      });

      if (result.success) {
        if (result.data) {
          setExamDate(result.data.examDate ? new Date(result.data.examDate) : examDate);
          setStudyHoursPerWeek(result.data.studyHoursPerWeek || studyHoursPerWeek);
          setSelfRating(result.data.selfRating || selfRating);
          setPreferredStudyDays((result.data.preferredStudyDays as number[]) || preferredStudyDays);
        }

        if (result.warnings && result.warnings.length > 0) {
          setWarnings(result.warnings);
          toast.success("Settings updated successfully! The study plan has been regenerated.");
        } else {
          toast.success("Settings updated successfully! The study plan has been regenerated.");
          setWarnings([]);
        }

        if (result.data) {
          queryClient.setQueryData(["course-settings", courseId], result.data);
        } else {
          queryClient.invalidateQueries({ queryKey: ["course-settings", courseId] });
        }

        setOpen(false);
        onUpdate?.();
      } else {
        setError(result.error || "Error updating settings");
        setWarnings([]);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  // Prevent hydration mismatch by only rendering Dialog after mount
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Settings className="h-4 w-4 mr-2" />
        Paramètres du plan
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Paramètres du plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres du plan d'étude</DialogTitle>
          <DialogDescription>
            Modifiez vos paramètres pour régénérer votre plan d'étude personnalisé
          </DialogDescription>
        </DialogHeader>
        {loadingSettings ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-semibold">Régénération du plan d'étude</p>
                    <p className="text-sm text-muted-foreground">Analyse et génération en cours…</p>
                  </div>
                </div>
                <Progress value={loadingProgress} />
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <div className={loadingProgress > 20 ? "text-foreground" : undefined}>Analyse du programme</div>
                  <div className={loadingProgress > 45 ? "text-foreground" : undefined}>Organisation des sessions</div>
                  <div className={loadingProgress > 70 ? "text-foreground" : undefined}>Finalisation du plan</div>
                </div>
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {warnings.length > 0 && (
              <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">Avertissements:</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Exam Date */}
            <div className="space-y-2">
              <Label htmlFor="examDate">Date d'examen *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !examDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {examDate ? (
                      format(examDate, "PPP", { locale: fr })
                    ) : (
                      <span>Sélectionner une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={examDate}
                    onSelect={setExamDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Study Hours Per Week */}
            <div className="space-y-2">
              <Label htmlFor="studyHours">Heures d'étude par semaine *</Label>
              <Input
                id="studyHours"
                type="number"
                min="1"
                max="40"
                value={studyHoursPerWeek}
                onChange={(e) => setStudyHoursPerWeek(parseInt(e.target.value) || 0)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Recommandé: {recommendedStudyHoursMin}-{recommendedStudyHoursMax} heures par semaine pour une préparation optimale
              </p>
            </div>

            {/* Preferred Study Days */}
            <div className="space-y-2">
              <Label>Jours d'étude préférés</Label>
              <div className="flex gap-2 flex-wrap">
                {dayLabels.map((label, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={preferredStudyDays.includes(index) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDayToggle(index)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Sélectionnez les jours où vous prévoyez étudier
              </p>
            </div>

            {/* Self Rating */}
            <div className="space-y-2">
              <Label>Niveau d'expérience *</Label>
              <RadioGroup value={selfRating} onValueChange={(value) => setSelfRating(value as SelfRating)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NOVICE" id="novice" />
                  <Label htmlFor="novice" className="font-normal cursor-pointer">
                    Débutant - Première fois que je prépare cet examen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="INTERMEDIATE" id="intermediate" />
                  <Label htmlFor="intermediate" className="font-normal cursor-pointer">
                    Intermédiaire - J'ai déjà étudié ce sujet
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="RETAKER" id="retaker" />
                  <Label htmlFor="retaker" className="font-normal cursor-pointer">
                    Reprenant - Je repasse l'examen
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Updating..." : "Update and regenerate the plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}


