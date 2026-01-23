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
            Watch this video to understand the exam format and how to use this platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Orientation Content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">About this exam</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This course prepares you for the exam. The format, difficulty, and passing criteria
                  will be explained in the video below.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">The three learning phases</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 1 - Learn</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    First complete pass through the syllabus with videos, notes, and mini-tests
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 2 - Review</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Consolidation through active recall and spaced repetition with flashcards and quizzes
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 3 - Practice</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Practice tests with exercises and mock exams
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
                        Video watched
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Mark as watched
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
                        Read and understood
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as read
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="border rounded-lg p-8 bg-muted/50 text-center">
                <p className="text-muted-foreground mb-4">
                  Orientation video (5-10 minutes)
                </p>
                <p className="text-sm text-muted-foreground">
                  The orientation video will be added by the administrator. It will explain the exam format,
                  passing score, and how to use this platform to maximize your chances of success.
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
                        Video watched
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Mark as watched
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
                {loading ? "Loading..." : "View my study plan"}
              </Button>
              <Button
                onClick={handleStartPhase1}
                disabled={loading || !videoWatched}
                className="w-full"
                size="lg"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                {loading ? "Loading..." : "Start Phase 1"}
              </Button>
            </div>
            {!videoWatched && (
              <p className="text-sm text-muted-foreground text-center">
                Please mark the video as watched before starting Phase 1
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

