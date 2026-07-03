"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { QuizQuestionType } from "@prisma/client";
import {
  getAdminQuizAttemptReviewAction,
  type AdminQuizAttemptReviewData,
} from "@/app/actions/students";
import { getAnswerDisplay, resolveAnswerIndex } from "@/lib/utils/quiz-answer-display";

type AdminQuizAttemptReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentUserId: string;
  attemptId: string | null;
};

function QuestionContent({ html }: { html: string }) {
  if (html.includes("<")) {
    return (
      <div
        className="prose prose-sm max-w-none text-sm font-medium"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p className="text-sm font-medium">{html}</p>;
}

export function AdminQuizAttemptReviewDialog({
  open,
  onOpenChange,
  studentUserId,
  attemptId,
}: AdminQuizAttemptReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminQuizAttemptReviewData | null>(null);

  useEffect(() => {
    if (!open || !attemptId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);

    void (async () => {
      const res = await getAdminQuizAttemptReviewAction(studentUserId, attemptId);
      if (cancelled) return;
      setLoading(false);
      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.error);
        setData(null);
        onOpenChange(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, attemptId, studentUserId, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] gap-0 p-0 overflow-hidden !flex !flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Attempt details</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-left">
              {data ? (
                <>
                  <div className="font-medium text-foreground">{data.quizTitle}</div>
                  <div className="text-sm">
                    {data.courseTitle} · {data.isMockExam ? "Exam" : "Quiz"} ·{" "}
                    {format(new Date(data.completedAt), "d MMM yyyy, HH:mm", { locale: enCA })} ·{" "}
                    {data.score}% / passing {data.passingScore}%
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">Loading answers…</span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-0">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && data && data.questions.length === 0 && (
            <p className="text-sm text-muted-foreground py-6">
              No questions are associated with this quiz.
            </p>
          )}

          {!loading && data && data.questions.length > 0 && (
            <div className="space-y-6 pt-2">
              {data.questions.map((question, questionIndex) => {
                const options = question.options || {};
                const userAnswer = data.userAnswers[question.id];
                const isShort =
                  question.type === QuizQuestionType.SHORT_ANSWER ||
                  Object.keys(options).length === 0;

                const userDisplay = isShort
                  ? userAnswer?.trim()
                    ? { label: userAnswer }
                    : getAnswerDisplay(undefined, options)
                  : getAnswerDisplay(userAnswer, options);

                const correctDisplay = isShort
                  ? { label: question.correctAnswer || "—" }
                  : getAnswerDisplay(question.correctAnswer, options);

                const userIndex = isShort ? null : resolveAnswerIndex(userAnswer, options);
                const correctIndex = isShort
                  ? null
                  : resolveAnswerIndex(question.correctAnswer, options);
                let studentAnswerClass = "text-foreground";
                if (isShort) {
                  const u = userAnswer?.trim() ?? "";
                  const c = question.correctAnswer?.trim() ?? "";
                  if (u || c) {
                    studentAnswerClass =
                      u.toLowerCase() === c.toLowerCase() ? "text-green-600" : "text-red-600";
                  }
                } else {
                  const correctMcq =
                    userIndex !== null &&
                    correctIndex !== null &&
                    userIndex === correctIndex;
                  studentAnswerClass = correctMcq ? "text-green-600" : "text-red-600";
                }

                return (
                  <div key={question.id} className="space-y-2 rounded-lg border p-4 bg-muted/30">
                    <div className="font-semibold text-sm text-muted-foreground">
                      Question {questionIndex + 1}
                    </div>
                    <QuestionContent html={question.question} />
                    <div className="text-sm">
                      <span className={`font-semibold ${studentAnswerClass}`}>
                        Student answer:
                      </span>
                      <span className="ml-2">{userDisplay.label}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">Correct answer:</span>
                      <span className="ml-2">{correctDisplay.label}</span>
                    </div>
                    {question.explanation && (
                      <div className="text-sm text-muted-foreground mt-2">
                        <span className="font-semibold">Explanation:</span>
                        <div className="mt-1">
                          <QuestionContent html={question.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
