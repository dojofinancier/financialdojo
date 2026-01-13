"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, FileText, Play, Layers, Brain, FileQuestion, BookOpen, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourseAction } from "@/app/actions/courses";
import { useEffect, useState } from "react";

interface LearningToolsProps {
  courseId: string;
  onToolSelect: (tool: string) => void;
}

const allTools = [
  {
    id: "videos",
    title: "Vidéos",
    description: "Regardez toutes les vidéos du cours",
    icon: Video,
    color: "text-red-500",
  },
  {
    id: "notes",
    title: "Notes",
    description: "Consultez toutes les notes de cours",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    id: "quizzes",
    title: "Quiz de modules",
    description: "Répondez aux quiz de chaque module",
    icon: FileQuestion,
    color: "text-purple-500",
  },
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Révisez avec les cartes mémoire",
    icon: Layers,
    color: "text-green-500",
  },
  {
    id: "activities",
    title: "Activités d'apprentissage",
    description: "Pratiquez avec les activités interactives",
    icon: Brain,
    color: "text-orange-500",
  },
  {
    id: "exams",
    title: "Examens simulés",
    description: "Testez vos connaissances avec les examens",
    icon: BookOpen,
    color: "text-indigo-500",
  },
  {
    id: "question-bank",
    title: "Banque de questions",
    description: "Pratiquez avec des questions aléatoires",
    icon: Play,
    color: "text-pink-500",
  },
  {
    id: "case-studies",
    title: "Études de cas",
    description: "Analysez des scénarios réels avec questions",
    icon: Briefcase,
    color: "text-amber-500",
  },
];

export function LearningTools({ courseId, onToolSelect }: LearningToolsProps) {
  const [course, setCourse] = useState<any>(null);

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const result = await getCourseAction(courseId);
      if (result) {
        setCourse(result);
      }
    } catch (error) {
      console.error("Error loading course:", error);
    }
  };

  // Filter tools based on component visibility
  const caseStudiesEnabled = course?.componentVisibility?.caseStudies ?? false;
  const tools = allTools.filter((tool) => {
    if (tool.id === "case-studies") {
      return caseStudiesEnabled;
    }
    // For other tools, check their visibility if needed
    // For now, we'll show all other tools by default
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Outils d'apprentissage</h2>
        <p className="text-muted-foreground">
          Accédez directement à tous les contenus du cours sans passer par le système de phases
        </p>
      </div>

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
                  Accéder
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

