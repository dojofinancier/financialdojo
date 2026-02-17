"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Target, FileText, BookOpen } from "lucide-react";
import { ExamList } from "./exam-list";
import { ExamPlayer } from "./exam-player";
import { QuestionBankPractice } from "./question-bank-practice";
import { CaseStudyList } from "./case-study-list";
import { CaseStudyPlayer } from "./case-study-player";


interface Phase3PracticeProps {
  courseId: string;
  course: any;
  settings: any;
}

export function Phase3Practice({ courseId, course, settings }: Phase3PracticeProps) {
  const [activeTab, setActiveTab] = useState<"exams" | "questions" | "case-studies">("exams");
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedCaseStudyId, setSelectedCaseStudyId] = useState<string | null>(null);
  // Check if case studies are enabled
  const caseStudiesEnabled = course?.componentVisibility?.caseStudies ?? false;



  if (selectedExamId) {
    return (
      <ExamPlayer
        examId={selectedExamId}
        onExit={() => {
          setSelectedExamId(null);
        }}
      />
    );
  }

  if (selectedCaseStudyId) {
    return (
      <CaseStudyPlayer
        caseStudyId={selectedCaseStudyId}
        onExit={() => {
          setSelectedCaseStudyId(null);
        }}
      />
    );
  }



  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Phase 3 - Practice and exam simulation
          </CardTitle>
          <CardDescription>
            Test your readiness and calibrate performance with practice exams, practice
            questions, and case studies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className={`grid w-full ${caseStudiesEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="exams">
                <FileText className="h-4 w-4 mr-2" />
                Practice exams
              </TabsTrigger>
              <TabsTrigger value="questions">
                <BookOpen className="h-4 w-4 mr-2" />
                Practice questions
              </TabsTrigger>
              {caseStudiesEnabled && (
                <TabsTrigger value="case-studies">
                  <FileText className="h-4 w-4 mr-2" />
                  Case studies
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="exams" className="mt-6">
              <ExamList courseId={courseId} onStartExam={setSelectedExamId} />
            </TabsContent>
            <TabsContent value="questions" className="mt-6">
              <QuestionBankPractice courseId={courseId} />
            </TabsContent>
            {caseStudiesEnabled && (
              <TabsContent value="case-studies" className="mt-6">
                <CaseStudyList courseId={courseId} onStartCaseStudy={setSelectedCaseStudyId} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
