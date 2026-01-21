"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import recharts to reduce initial bundle size
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

interface CompletionRatesChartProps {
  data: Array<{
    courseId: string;
    courseTitle: string;
    averageCompletionRate: number;
  }>;
}

export function CompletionRatesChart({ data }: CompletionRatesChartProps) {
  const chartData = data
    .sort((a, b) => b.averageCompletionRate - a.averageCompletionRate)
    .slice(0, 10)
    .map((item) => ({
      course: item.courseTitle.length > 30 ? item.courseTitle.substring(0, 30) + "..." : item.courseTitle,
      "Completion rate": Math.round(item.averageCompletionRate * 10) / 10,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="course" angle={-45} textAnchor="end" height={100} />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(value) => `${Number(value)}%`} />
        <Legend />
        <Bar dataKey="Completion rate" fill="hsl(var(--accent))" />
      </BarChart>
    </ResponsiveContainer>
  );
}

