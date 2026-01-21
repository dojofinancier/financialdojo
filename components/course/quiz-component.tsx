"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { submitQuizAttemptAction } from "@/app/actions/quizzes";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Quiz = {
  id: string;
  title: string;
  passingScore: number;
  timeLimit: number | null;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    options: any;
    correctAnswer: string;
    order: number;
  }>;
};

interface QuizComponentProps {
  quiz: Quiz;
  contentItemId: string;
}

export function QuizComponent({ quiz, contentItemId }: QuizComponentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    quiz.timeLimit ? quiz.timeLimit * 60 : null
  );
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startTime] = useState(Date.now());

  // Timer for timed quizzes/exams
  useEffect(() => {
    if (!quiz.timeLimit || submitted) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quiz.timeLimit, submitted]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && Object.keys(answers).length < quiz.questions.length) {
      toast.error("Please answer all questions");
      return;
    }

    setLoading(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      const result = await submitQuizAttemptAction({
        quizId: quiz.id,
        answers,
        timeSpent,
      });

      if (result.success) {
        setSubmitted(true);
        setResult(result.data);
        toast.success(
          result.data.passed
            ? `Félicitations! Vous avez réussi avec ${result.data.score}%`
            : `Score: ${result.data.score}%. Score de passage: ${result.data.passingScore}%`
        );
      } else {
        toast.error(result.error || "Error during submission");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isQuiz = !quiz.timeLimit;
  const isExam = !!quiz.timeLimit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{quiz.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {isQuiz && <Badge variant="outline">Quiz</Badge>}
              {isExam && <Badge variant="destructive">Examen</Badge>}
              <Badge variant="secondary">
                Score de passage: {quiz.passingScore}%
              </Badge>
            </div>
          </div>
          {isExam && timeRemaining !== null && (
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5" />
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {submitted && result && (
          <Alert className={result.passed ? "border-green-500" : "border-red-500"}>
            <div className="flex items-center gap-2">
              {result.passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <AlertDescription>
                <div className="font-semibold">
                  Score: {result.score}% ({result.correctAnswers}/{result.totalQuestions} bonnes réponses)
                </div>
                {result.passed ? (
                  <div className="text-green-600 mt-1">Félicitations! Vous avez réussi.</div>
                ) : (
                  <div className="text-red-600 mt-1">
                    Score de passage requis: {result.passingScore}%
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {quiz.questions.map((question, index) => {
          const userAnswer = answers[question.id];
          const isCorrect = submitted && result && userAnswer?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

          return (
            <div key={question.id} className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="font-semibold">{index + 1}.</span>
                <div className="flex-1">
                  {/* Case studies are MULTIPLE_CHOICE questions with HTML content */}
                  {question.type === "MULTIPLE_CHOICE" && question.question.includes("<") ? (
                    <div
                      className="prose max-w-none mb-4 p-4 bg-muted rounded-md"
                      dangerouslySetInnerHTML={{ __html: question.question }}
                    />
                  ) : (
                    <p className="font-medium">{question.question}</p>
                  )}

                  {question.type === "MULTIPLE_CHOICE" && (
                    <RadioGroup
                      value={userAnswer || ""}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                      disabled={submitted}
                      className="mt-3"
                    >
                      {question.options &&
                        Object.entries(question.options as Record<string, string>).map(
                          ([key, value]) => (
                            <div key={key} className="flex items-center space-x-2">
                              <RadioGroupItem value={key} id={`${question.id}-${key}`} />
                              <Label
                                htmlFor={`${question.id}-${key}`}
                                className={`cursor-pointer ${
                                  submitted && key === question.correctAnswer
                                    ? "text-green-600 font-semibold"
                                    : submitted && key === userAnswer && !isCorrect
                                    ? "text-red-600"
                                    : ""
                                }`}
                              >
                                {key}: {value}
                              </Label>
                            </div>
                          )
                        )}
                    </RadioGroup>
                  )}

                  {question.type === "TRUE_FALSE" && (
                    <RadioGroup
                      value={userAnswer || ""}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                      disabled={submitted}
                      className="mt-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id={`${question.id}-true`} />
                        <Label
                          htmlFor={`${question.id}-true`}
                          className={`cursor-pointer ${
                            submitted && "true" === question.correctAnswer.toLowerCase()
                              ? "text-green-600 font-semibold"
                              : submitted && "true" === userAnswer?.toLowerCase() && !isCorrect
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          Vrai
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id={`${question.id}-false`} />
                        <Label
                          htmlFor={`${question.id}-false`}
                          className={`cursor-pointer ${
                            submitted && "false" === question.correctAnswer.toLowerCase()
                              ? "text-green-600 font-semibold"
                              : submitted && "false" === userAnswer?.toLowerCase() && !isCorrect
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          Faux
                        </Label>
                      </div>
                    </RadioGroup>
                  )}

                  {question.type === "SHORT_ANSWER" && (
                    <Textarea
                      value={userAnswer || ""}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      disabled={submitted}
                      placeholder="Your answer..."
                      className="mt-3"
                    />
                  )}

                  {submitted && (
                    <div className="mt-2 text-sm">
                      {isCorrect ? (
                        <div className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Correct
                        </div>
                      ) : (
                        <div className="text-red-600 flex items-center gap-1">
                          <XCircle className="h-4 w-4" />
                          Incorrect. Réponse correcte: {question.correctAnswer}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!submitted && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => handleSubmit(false)} disabled={loading} size="lg">
              {loading ? "Soumission..." : "Soumettre"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

