"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, FileText, Play, Layers, Brain, FileQuestion, BookOpen, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourseAction } from "@/app/actions/courses";
import { getCaseStudiesAction } from "@/app/actions/case-studies";
import { useEffect, useState, useCallback } from "react";

interface LearningToolsProps {
  courseId: string;
  onToolSelect: (tool: string) => void;
}

const allTools = [
  {
    id: "videos",
    title: "Videos",
    description: "Watch all course videos",
    icon: Video,
    color: "text-red-500",
  },
  {
    id: "notes",
    title: "Notes",
    description: "View all course notes",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    id: "quizzes",
    title: "Quiz de modules",
    description: "Take the quizzes for each module",
    icon: FileQuestion,
    color: "text-purple-500",
  },
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Review with flashcards",
    icon: Layers,
    color: "text-green-500",
  },
  {
    id: "activities",
    title: "Learning Activities",
    description: "Practice with interactive activities",
    icon: Brain,
    color: "text-orange-500",
  },
  {
    id: "exams",
    title: "Simulated Exams",
    description: "Testez vos connaissances avec les examens",
    icon: BookOpen,
    color: "text-indigo-500",
  },
  {
    id: "question-bank",
    title: "Banque de questions",
    description: "Practice with random questions",
    icon: Play,
    color: "text-pink-500",
  },
  {
    id: "case-studies",
    title: "Case Studies",
    description: "Analyze real-world scenarios with questions",
    icon: Briefcase,
    color: "text-amber-500",
  },
];

export function LearningTools({ courseId, onToolSelect }: LearningToolsProps) {
  const [course, setCourse] = useState<any>(null);
  const [hasCaseStudies, setHasCaseStudies] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      const [courseResult, caseStudiesResult] = await Promise.all([
        getCourseAction(courseId),
        getCaseStudiesAction(courseId),
      ]);

      if (courseResult) {
        setCourse(courseResult);
      }

      if (caseStudiesResult.success && caseStudiesResult.data) {
        setHasCaseStudies(caseStudiesResult.data.length > 0);
      }
    } catch (error) {
      console.error("Error loading course:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Filter tools based on component visibility
  const componentVisibility = course?.componentVisibility || {};
  const videosEnabled = course ? componentVisibility.videos !== false : false;
  const notesEnabled = course ? componentVisibility.notes !== false : false;
  const quizzesEnabled = course ? componentVisibility.quizzes !== false : false;
  const flashcardsEnabled = course ? componentVisibility.flashcards !== false : false;
  const caseStudiesEnabled = hasCaseStudies;

  const tools = allTools.filter((tool) => {
    if (tool.id === "videos") return videosEnabled;
    if (tool.id === "notes") return notesEnabled;
    if (tool.id === "quizzes") return quizzesEnabled;
    if (tool.id === "flashcards") return flashcardsEnabled;
    if (tool.id === "case-studies") return caseStudiesEnabled;
    // Activities, exams, and question-bank are always available
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Learning tools</h2>
        <p className="text-muted-foreground">
          Access all course content directly without going through the phase system
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Loading tools...
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => onToolSelect(tool.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-muted ${tool.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Access
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
