"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFlashcardStudySessionAction } from "@/app/actions/flashcards";
import { toast } from "sonner";
import { RotateCcw, ThumbsUp, ThumbsDown, Loader2, Shuffle } from "lucide-react";
import { useFlashcards } from "@/lib/hooks/use-flashcards";
import { useCourseModules } from "@/lib/hooks/use-learning-activities";

interface FlashcardComponentProps {
  courseId: string;
  contentItemId: string;
  reviewMode?: boolean;
}

export function FlashcardComponent({ courseId, contentItemId }: FlashcardComponentProps) {
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [randomMode, setRandomMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studied, setStudied] = useState<Set<string>>(new Set());

  // Use React Query for flashcards and modules
  const { data: flashcardsResult, isLoading: flashcardsLoading } = useFlashcards(courseId);
  const { data: modulesData, isLoading: modulesLoading } = useCourseModules(courseId);

  const allFlashcards = useMemo(() => {
    if (!flashcardsResult?.success || !flashcardsResult.data) return [];
    return flashcardsResult.data.map((card: any) => ({
      ...card,
      moduleId: card.moduleId ?? null,
    }));
  }, [flashcardsResult]);

  const modules = (modulesData || []) as Array<{ id: string; title: string }>;
  const loading = flashcardsLoading || modulesLoading;

  useEffect(() => {
    filterFlashcards();
  }, [selectedModuleId, randomMode, allFlashcards]);


  const filterFlashcards = () => {
    let filtered = [...allFlashcards];

    if (selectedModuleId) {
      filtered = filtered.filter((card) => {
        // Handle both null and undefined moduleId
        const cardModuleId = card.moduleId ?? null;
        return cardModuleId === selectedModuleId;
      });
    }

    if (randomMode) {
      // Shuffle array
      filtered = filtered.sort(() => Math.random() - 0.5);
    }

    setFlashcards(filtered);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDifficulty = async (difficulty: "EASY" | "DIFFICULT") => {
    const currentCard = flashcards[currentIndex];
    if (!currentCard) return;

    try {
      await createFlashcardStudySessionAction({
        flashcardId: currentCard.id,
        difficulty,
      });

      setStudied((prev) => new Set(prev).add(currentCard.id));

      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        toast.success("All flashcards have been studied!");
      }
    } catch (error) {
      toast.error("Error saving");
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setStudied(new Set());
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

  if (flashcards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune flashcard disponible</p>
        </CardContent>
      </Card>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <>
      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
      <Card className="border-0 shadow-none sm:border sm:shadow">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Flashcards</CardTitle>
            <Badge variant="outline">
              {currentIndex + 1} / {flashcards.length}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={selectedModuleId || "all"}
              onValueChange={(value) => {
                setSelectedModuleId(value === "all" ? null : value);
                setRandomMode(false);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Tous les modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les modules</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={randomMode ? "default" : "outline"}
              onClick={() => {
                setRandomMode(!randomMode);
                if (!randomMode) {
                  setSelectedModuleId(null);
                }
              }}
              className="flex items-center gap-2"
            >
              <Shuffle className="h-4 w-4" />
              Aléatoire
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Flashcard */}
          <div
            className="relative h-64 cursor-pointer perspective-1000"
            onClick={handleFlip}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
                isFlipped ? "rotate-y-180" : ""
              }`}
            >
              {/* Front */}
              <div
                className={`absolute inset-0 backface-hidden ${
                  isFlipped ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
                <Card className="h-full flex items-center justify-center border-0 shadow-none sm:border sm:shadow">
                  <CardContent className="text-center p-6">
                    <p className="text-lg font-medium">{currentCard.front}</p>
                    <p className="text-sm text-muted-foreground mt-4">
                      Cliquez pour retourner
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Back */}
              <div
                className={`absolute inset-0 backface-hidden rotate-y-180 ${
                  isFlipped ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <Card className="h-full flex items-center justify-center bg-primary text-primary-foreground border-0 shadow-none sm:border sm:shadow">
                  <CardContent className="text-center p-6">
                    <p className="text-lg font-medium">{currentCard.back}</p>
                    <p className="text-sm opacity-80 mt-4">
                      Cliquez pour retourner
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

        {/* Controls */}
        {isFlipped && (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => handleDifficulty("EASY")}
              className="flex-1"
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Facile
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDifficulty("DIFFICULT")}
              className="flex-1"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Difficile
            </Button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-4 border-t border-border/40 sm:border-border">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1 sm:flex-initial"
          >
            ← Précédent
          </Button>
          <Button 
            variant="outline" 
            onClick={handleReset} 
            size="sm"
            className="flex-1 sm:flex-initial"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            className="flex-1 sm:flex-initial"
          >
            Suivant →
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

