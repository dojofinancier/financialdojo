"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateTimeSpentAction, trackContentCompletionAction } from "@/app/actions/progress";
import { Play, Pause, Clock } from "lucide-react";
import Script from "next/script";

type Video = {
  id: string;
  vimeoUrl: string;
  duration: number | null;
  transcript: string | null;
};

interface VideoPlayerProps {
  video: Video;
  contentItemId: string;
}

export function VideoPlayer({ video, contentItemId }: VideoPlayerProps) {
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const playerRef = useRef<HTMLDivElement>(null);
  const timeTrackingRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackedTimeRef = useRef(0);
  const currentTimeRef = useRef(0);

  // Extract Vimeo video ID from URL
  const getVimeoId = (url: string): string | null => {
    const match = url.match(/(?:vimeo\.com\/)(?:.*\/)?(\d+)/);
    return match ? match[1] : null;
  };

  const vimeoId = getVimeoId(video.vimeoUrl);

  const startTimeTracking = useCallback(() => {
    if (timeTrackingRef.current) return;

    timeTrackingRef.current = setInterval(async () => {
      const timeSpent = currentTimeRef.current - lastTrackedTimeRef.current;
      if (timeSpent > 5) {
        // Track every 5 seconds
        await updateTimeSpentAction(contentItemId, Math.floor(timeSpent));
        lastTrackedTimeRef.current = currentTimeRef.current;
      }
    }, 5000);
  }, [contentItemId]);

  const stopTimeTracking = useCallback(() => {
    if (timeTrackingRef.current) {
      clearInterval(timeTrackingRef.current);
      timeTrackingRef.current = null;
    }
  }, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!vimeoId || !window.Vimeo) return;

    const vimeoPlayer = new window.Vimeo.Player(playerRef.current!, {
      id: vimeoId,
      width: 640,
    });

    vimeoPlayer.on("play", () => {
      setIsPlaying(true);
      startTimeTracking();
    });

    vimeoPlayer.on("pause", () => {
      setIsPlaying(false);
      stopTimeTracking();
    });

    vimeoPlayer.on("timeupdate", (data: { seconds: number }) => {
      setCurrentTime(data.seconds);
    });

    vimeoPlayer.getDuration().then((dur: number) => {
      setDuration(dur);
    });

    setPlayer(vimeoPlayer);

    return () => {
      if (timeTrackingRef.current) {
        clearInterval(timeTrackingRef.current);
      }
      vimeoPlayer.destroy();
    };
  }, [vimeoId, startTimeTracking, stopTimeTracking]);


  const handlePlayPause = async () => {
    if (!player) return;

    if (isPlaying) {
      await player.pause();
    } else {
      await player.play();
    }
  };

  const handleComplete = async () => {
    if (!player) return;

    await trackContentCompletionAction(contentItemId);
    stopTimeTracking();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!vimeoId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">URL Vimeo invalide</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Script src="https://player.vimeo.com/api/player.js" strategy="lazyOnload" />
      <Card>
        <CardContent className="p-0">
          <div ref={playerRef} className="w-full aspect-video bg-black" />
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePlayPause} size="sm" variant="outline">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button onClick={handleComplete} size="sm">
                  Mark as completed
                </Button>
              </div>
            </div>
            {video.transcript && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <h3 className="font-semibold mb-2">Transcript</h3>
                <p className="text-sm whitespace-pre-wrap">{video.transcript}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Extend Window interface for Vimeo
declare global {
  interface Window {
    Vimeo: any;
  }
}

