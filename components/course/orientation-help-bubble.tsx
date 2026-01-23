"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrientationHelpBubbleProps {
  courseId: string;
  courseTitle: string;
  orientationVideoUrl?: string | null;
}

export function OrientationHelpBubble({
  courseId,
  courseTitle,
  orientationVideoUrl,
}: OrientationHelpBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

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

  if (!orientationVideoUrl || !embedUrl) {
    return null; // Don't show if no video URL
  }

  return (
    <>
      {/* Floating Help Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
          aria-label="Watch the orientation video"
        >
          <HelpCircle className="h-7 w-7 sm:h-8 sm:w-8" />
        </Button>
      </div>

      {/* Dialog with Orientation Video */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orientation video</DialogTitle>
            <DialogDescription>
              Rewatch this video to refresh study tips and the exam format
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Study tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  This video contains important information about:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>The exam format</li>
                  <li>The passing score</li>
                  <li>How to use this platform effectively</li>
                  <li>Recommended study strategies</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
