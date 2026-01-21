"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Play, Calendar, BookOpen } from "lucide-react";
import { completeOrientationAction } from "@/app/actions/study-plan";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";

interface OrientationVideoProps {
  courseId: string;
  courseTitle: string;
  orientationVideoUrl?: string | null;
  orientationText?: string | null;
  firstModuleId?: string | null;
  onComplete?: () => void;
}

export function OrientationVideo({ courseId, courseTitle, orientationVideoUrl, orientationText, firstModuleId, onComplete }: OrientationVideoProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [sanitizedText, setSanitizedText] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && orientationText) {
      // Sanitize HTML content using DOMPurify
      const clean = DOMPurify.sanitize(orientationText, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'span', 'div',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'sup', 'sub'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
          'width', 'height', 'align'
        ],
        ALLOW_DATA_ATTR: false,
      });
      setSanitizedText(clean);
    }
  }, [orientationText]);

  // Helper function to extract Vimeo embed URL (same as module-detail-page.tsx)
  const getVimeoEmbedUrl = (vimeoUrl: string): string => {
    // If it's already a full embed URL with parameters, extract the src
    if (vimeoUrl.includes('player.vimeo.com')) {
      // Extract the src URL from iframe tag if it's wrapped in HTML
      const srcMatch = vimeoUrl.match(/src="([^"]+)"/);
      if (srcMatch) {
        return srcMatch[1].replace(/&amp;/g, '&');
      }
      // If it's just the URL, return it
      return vimeoUrl.replace(/&amp;/g, '&');
    }
    
    // Otherwise, extract the video ID and create a basic embed URL
    const vimeoIdMatch = vimeoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoIdMatch) {
      return `https://player.vimeo.com/video/${vimeoIdMatch[1]}?autoplay=0&title=0&byline=0&portrait=0`;
    }
    
    return vimeoUrl;
  };

  const embedUrl = orientationVideoUrl ? getVimeoEmbedUrl(orientationVideoUrl) : null;

  const handleComplete = async () => {
    setLoading(true);
    try {
      const result = await completeOrientationAction(courseId);
      if (result.success) {
        toast.success("Orientation completed!");
        router.refresh();
        onComplete?.();
      } else {
        toast.error(result.error || "Error completing orientation");
      }
    } catch (err) {
      console.error("Error completing orientation:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlan = async () => {
    if (!videoWatched) {
      toast.error("Please mark the video as watched first");
      return;
    }

    setLoading(true);
    try {
      // Complete orientation first
      const result = await completeOrientationAction(courseId);
      if (result.success) {
        toast.success("Orientation completed!");
        // Call onComplete to update parent state
        onComplete?.();
        // Use window.location for a full page reload to ensure fresh data
        // This ensures the server fetches updated settings
        window.location.href = `/learn/${courseId}`;
      } else {
        toast.error(result.error || "Error completing orientation");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error completing orientation:", err);
      toast.error("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleStartPhase1 = async () => {
    if (!videoWatched) {
      toast.error("Please mark the video as watched first");
      return;
    }

    setLoading(true);
    try {
      // Complete orientation first
      const result = await completeOrientationAction(courseId);
      if (result.success) {
        toast.success("Orientation completed!");
        // Call onComplete to update parent state
        onComplete?.();
        // Use window.location for a full page reload to ensure fresh data
        // Navigate to first module of phase 1
        if (firstModuleId) {
          window.location.href = `/learn/${courseId}?module=${firstModuleId}`;
        } else {
          window.location.href = `/learn/${courseId}`;
        }
      } else {
        toast.error(result.error || "Error completing orientation");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error completing orientation:", err);
      toast.error("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Phase 0 - Orientation</CardTitle>
          <CardDescription>
            Regardez cette vidéo pour comprendre le format de l'examen et comment utiliser cette plateforme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Orientation Content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">À propos de cet examen</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Cette formation vous prépare à l'examen. Le format, la difficulté et les critères de réussite
                  seront expliqués dans la vidéo ci-dessous.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Les trois phases d'apprentissage</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 1 - Apprendre</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Première passe complète du syllabus avec vidéos, notes et mini-tests
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 2 - Réviser</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Consolidation via rappel actif et répétition espacée avec flashcards et quiz
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 3 - Pratiquer</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Tests de préparation avec exercices et examens simulés
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Video Player or Text Explainer */}
            {embedUrl ? (
              <>
                <div className="border rounded-lg overflow-hidden bg-black">
                  <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
                    <iframe
                      src={embedUrl}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                      title="Orientation video"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoWatched(!videoWatched)}
                    className={videoWatched ? "bg-primary text-primary-foreground" : ""}
                  >
                    {videoWatched ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Vidéo regardée
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Marquer comme regardée
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : orientationText && sanitizedText ? (
              <>
                <div className="border rounded-lg p-6 bg-muted/50">
                  <div 
                    className="prose prose-sm max-w-none prose-headings:font-bold prose-p:text-gray-700 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:list-disc prose-ol:list-decimal"
                    dangerouslySetInnerHTML={{ __html: sanitizedText }}
                  />
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoWatched(!videoWatched)}
                    className={videoWatched ? "bg-primary text-primary-foreground" : ""}
                  >
                    {videoWatched ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Lu et compris
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marquer comme lu
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="border rounded-lg p-8 bg-muted/50 text-center">
                <p className="text-muted-foreground mb-4">
                  Vidéo d'orientation (5-10 minutes)
                </p>
                <p className="text-sm text-muted-foreground">
                  La vidéo d'orientation sera ajoutée par l'administrateur. Elle expliquera le format de l'examen,
                  la note de passage, et comment utiliser cette plateforme pour maximiser vos chances de réussite.
                </p>
                {/* Allow marking as watched even without video */}
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVideoWatched(!videoWatched)}
                    className={videoWatched ? "bg-primary text-primary-foreground" : ""}
                  >
                    {videoWatched ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Vidéo regardée
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Marquer comme regardée
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Button
                onClick={handleViewPlan}
                disabled={loading || !videoWatched}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Calendar className="h-5 w-5 mr-2" />
                {loading ? "Chargement..." : "View my study plan"}
              </Button>
              <Button
                onClick={handleStartPhase1}
                disabled={loading || !videoWatched}
                className="w-full"
                size="lg"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                {loading ? "Chargement..." : "Commencer la phase 1"}
              </Button>
            </div>
            {!videoWatched && (
              <p className="text-sm text-muted-foreground text-center">
                Veuillez marquer la vidéo comme regardée avant de commencer la phase 1
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


