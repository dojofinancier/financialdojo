"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Brain, Target, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Dynamically import recharts to reduce initial bundle size
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

interface PerformanceSectionProps {
  data: {
    quizScoreTrends: Array<{
      date: Date;
      score: number;
      quizTitle: string;
    }>;
    modulePerformance: Array<{
      moduleId: string;
      moduleTitle: string;
      moduleOrder: number;
      averageScore: number | null;
      completionRate: number;
      errorRate: number;
      memoryStrength: number;
    }>;
    weakAreas: Array<{
      moduleId: string;
      moduleTitle: string;
      issues: string[];
    }>;
    reviewEffectiveness: {
      sessionsCompleted: number;
      averageItemsPerSession: number;
      masteryRate: number;
      difficultyDistribution: {
        easy: number;
        difficult: number;
      };
    };
  };
}

export function PerformanceSection({ data }: PerformanceSectionProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Aucune donnée disponible</p>
      </div>
    );
  }

  // Format quiz score trends for chart
  const quizTrendsData = (data.quizScoreTrends || []).map((item) => ({
    date: format(new Date(item.date), "d MMM", { locale: fr }),
    score: item.score,
  }));

  // Format module performance for chart
  const modulePerformanceData = (data.modulePerformance || [])
    .filter((m) => m.averageScore !== null)
    .map((m) => ({
      module: `Module ${m.moduleOrder}`,
      score: m.averageScore!,
      completion: m.completionRate,
    }));

  return (
    <div className="space-y-6">
      {/* Quiz Score Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendances des scores de quiz
          </CardTitle>
          <CardDescription>Évolution de vos scores au fil du temps</CardDescription>
        </CardHeader>
        <CardContent>
          {quizTrendsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quizTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#8884d8" name="Score (%)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun quiz complété pour le moment
            </p>
          )}
        </CardContent>
      </Card>

      {/* Module Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance par module
          </CardTitle>
          <CardDescription>Scores moyens et taux de complétion par module</CardDescription>
        </CardHeader>
        <CardContent>
          {modulePerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modulePerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="module" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#8884d8" name="Score moyen (%)" />
                <Bar dataKey="completion" fill="#82ca9d" name="Completion (%)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune donnée de performance disponible
            </p>
          )}
        </CardContent>
      </Card>

      {/* Weak Areas */}
      {data.weakAreas && data.weakAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Zones à améliorer
            </CardTitle>
            <CardDescription>Modules nécessitant une attention particulière</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.weakAreas.map((area) => (
                <div key={area.moduleId} className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <p className="font-medium mb-2">{area.moduleTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {area.issues.map((issue, idx) => (
                      <Badge key={idx} variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Efficacité de la révision
          </CardTitle>
          <CardDescription>Statistiques sur vos sessions de révision</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-2xl font-bold">{data.reviewEffectiveness.sessionsCompleted}</p>
              <p className="text-xs text-muted-foreground">Sessions complétées</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.reviewEffectiveness.averageItemsPerSession.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">Éléments par session (moyenne)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.reviewEffectiveness.masteryRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Taux de maîtrise</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-2">Distribution de difficulté</p>
            <div className="flex gap-4">
              <div>
                <p className="text-lg font-bold text-green-600">
                  {data.reviewEffectiveness.difficultyDistribution.easy}
                </p>
                <p className="text-xs text-muted-foreground">Faciles</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">
                  {data.reviewEffectiveness.difficultyDistribution.difficult}
                </p>
                <p className="text-xs text-muted-foreground">Difficiles</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

