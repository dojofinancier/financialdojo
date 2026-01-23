"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCourseModulesAction } from "@/app/actions/modules";
import { getBatchModuleContentAction } from "@/app/actions/module-content";
import { Video, ChevronLeft, ChevronRight } from "lucide-react";

interface VideoItem {
  id: string;
  order: number;
  video: {
    id: string;
    vimeoUrl: string;
    duration: number | null;
    transcript: string | null;
  };
}

interface ModuleData {
  id: string;
  title: string;
  order: number;
  videos: VideoItem[];
}

interface VideosToolProps {
  courseId: string;
  onBack: () => void;
}

export function VideosTool({ courseId, onBack }: VideosToolProps) {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAllModules = useCallback(async () => {
    try {
      setLoading(true);
      const courseModules = await getCourseModulesAction(courseId);
      
      // Batch load content for all modules with full video data
      const moduleIds = courseModules.map((m) => m.id);
      const batchResult = await getBatchModuleContentAction(moduleIds, true); // includeFullData = true
      
      const modulesWithVideos: ModuleData[] = [];

      if (batchResult.success && batchResult.data) {
        for (const moduleRecord of courseModules) {
          const moduleContent = batchResult.data[moduleRecord.id];
          if (moduleContent && moduleContent.videos && moduleContent.videos.length > 0) {
            modulesWithVideos.push({
              id: moduleRecord.id,
              title: moduleRecord.title,
              order: moduleRecord.order,
              videos: moduleContent.videos.map((videoItem: any) => ({
                id: videoItem.id,
                order: videoItem.order,
                video: videoItem.video, // Full video data already included
              })),
            });
          }
        }
      }

      // Sort by module order
      modulesWithVideos.sort((a, b) => a.order - b.order);

      setModules(modulesWithVideos);
      
      // Auto-select first module if available
      if (modulesWithVideos.length > 0) {
        setSelectedModuleId(modulesWithVideos[0].id);
      }
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAllModules();
  }, [loadAllModules]);

  useEffect(() => {
    // Reset video index when module changes
    setCurrentVideoIndex(0);
  }, [selectedModuleId]);

  const getVimeoEmbedUrl = (vimeoUrl: string): string => {
    if (vimeoUrl.includes('player.vimeo.com')) {
      const srcMatch = vimeoUrl.match(/src="([^"]+)"/);
      if (srcMatch) {
        return srcMatch[1].replace(/&amp;/g, '&');
      }
      return vimeoUrl.replace(/&amp;/g, '&');
    }
    
    const vimeoIdMatch = vimeoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoIdMatch) {
      return `https://player.vimeo.com/video/${vimeoIdMatch[1]}?autoplay=0&title=0&byline=0&portrait=0`;
    }
    
    return vimeoUrl;
  };

  const selectedModule = modules.find((m) => m.id === selectedModuleId);
  const currentVideo = selectedModule?.videos[currentVideoIndex];
  const currentModuleIndex = modules.findIndex((m) => m.id === selectedModuleId);

  const handlePreviousVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    } else if (currentModuleIndex > 0) {
      // Move to previous module's last video
      const prevModule = modules[currentModuleIndex - 1];
      setSelectedModuleId(prevModule.id);
      setCurrentVideoIndex(prevModule.videos.length - 1);
    }
  };

  const handleNextVideo = () => {
    if (selectedModule && currentVideoIndex < selectedModule.videos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
      // Move to next module's first video
      const nextModule = modules[currentModuleIndex + 1];
      setSelectedModuleId(nextModule.id);
      setCurrentVideoIndex(0);
    }
  };

  const canGoPrevious = currentVideoIndex > 0 || currentModuleIndex > 0;
  const canGoNext = 
    (selectedModule && currentVideoIndex < selectedModule.videos.length - 1) ||
    currentModuleIndex < modules.length - 1;

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
            <div className="aspect-video bg-muted animate-pulse rounded" />
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
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No videos available for this course.</p>
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
          Back
        </Button>
        <div className="flex items-center gap-4">
          <Select value={selectedModuleId || ""} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((moduleRecord) => (
                <SelectItem key={moduleRecord.id} value={moduleRecord.id}>
                  Module {moduleRecord.order + 1}: {moduleRecord.title} ({moduleRecord.videos.length} video{moduleRecord.videos.length > 1 ? 's' : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedModule && currentVideo && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedModule.title}
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-2">
              Video {currentVideoIndex + 1} / {selectedModule.videos.length}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{ padding: '56.25% 0 0 0', position: 'relative' }}>
              <iframe
                src={getVimeoEmbedUrl(currentVideo.video.vimeoUrl)}
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                title={`${selectedModule.title} - Video ${currentVideoIndex + 1}`}
              />
            </div>

            {currentVideo.video.transcript && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-sm font-semibold mb-2">Transcription:</div>
                <div className="text-sm whitespace-pre-wrap">{currentVideo.video.transcript}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePreviousVideo}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={handleNextVideo}
                disabled={!canGoNext}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
