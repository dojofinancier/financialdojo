"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, BookOpen, Settings } from "lucide-react";
import { checkBehindScheduleAction } from "@/app/actions/study-plan";
import { toast } from "sonner";

interface BehindScheduleWarningProps {
  courseId: string;
}

export function BehindScheduleWarning({ courseId }: BehindScheduleWarningProps) {
  const [isBehind, setIsBehind] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [unlearnedModules, setUnlearnedModules] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSchedule();
  }, [courseId]);

  const checkSchedule = async () => {
    try {
      setLoading(true);
      const result = await checkBehindScheduleAction(courseId);
      
      if (result.success && result.isBehind) {
        setIsBehind(true);
        setWarning(result.warning || null);
        setSuggestions(result.suggestions || []);
        setUnlearnedModules(result.unlearnedModules || 0);
      } else {
        setIsBehind(false);
        setWarning(null);
        setSuggestions([]);
        setUnlearnedModules(0);
      }
    } catch (error) {
      console.error("Error checking schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isBehind || !warning) {
    return null;
  }

  return (
    <Alert variant="default" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
      <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertTitle className="text-orange-800 dark:text-orange-200 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Vous êtes en retard sur votre plan d'étude
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        <p className="text-orange-700 dark:text-orange-300">{warning}</p>
        
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
              Suggestions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-orange-700 dark:text-orange-300">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="border-orange-600 text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
            onClick={() => {
              // Navigate to module progress to mark as learned
              window.location.href = `/learn/${courseId}?tab=learn`;
            }}
          >
            <BookOpen className="h-3 w-3 mr-1" />
            Marquer les modules terminés
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-600 text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
            onClick={() => {
              // Open settings dialog - this would need to be handled by parent
              toast.info("Open the plan settings to change your study hours or exam date");
            }}
          >
            <Settings className="h-3 w-3 mr-1" />
            Modifier les paramètres
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

