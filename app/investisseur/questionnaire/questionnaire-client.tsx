"use client";

import Link from "next/link";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { INVESTISSEUR_QUESTIONS, computeInvestisseurResult } from "@/lib/constants/investor-diagnostic";
import { submitInvestisseurDiagnosticAction } from "@/app/actions/investisseur-diagnostic";
import { toast } from "sonner";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function QuestionnaireClient() {
  const questions = INVESTISSEUR_QUESTIONS;
  const total = questions.length || 6;

  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [lead, setLead] = useState({ firstName: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isDone = stepIdx >= questions.length;
  const current = questions[clamp(stepIdx, 0, Math.max(0, questions.length - 1))];
  const currentValue = current ? responses[current.id] ?? "" : "";

  const answeredCount = Object.keys(responses).length;
  const progressValue = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const canGoNext = isDone ? true : Boolean(currentValue);
  const result = isDone ? computeInvestisseurResult(responses) : null;

  const goNext = () => {
    if (!canGoNext) return;
    setStepIdx((v) => v + 1);
  };

  const goBack = () => setStepIdx((v) => Math.max(0, v - 1));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6ede4] text-neutral-900">
      {/* Top header (default navbar is hidden via RouteChrome) */}
      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <Progress value={progressValue} className="h-2 bg-neutral-200" />
          <div className="mt-5 text-center">
            <p className="text-sm font-semibold text-neutral-700">Investor clarity diagnostic</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Questionnaire</h1>
            {!isDone && (
              <p className="mt-2 text-sm text-neutral-600">
                Question {stepIdx + 1} of {total}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Standalone nav row */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/investor" className="text-sm font-semibold text-neutral-700 hover:underline underline-offset-4">
            ← Back to page
          </Link>
          <Link href="/" className="text-sm font-black tracking-tight">
            FINANCIAL DOJO
          </Link>
        </div>

        {!isDone ? (
          <div className="rounded-2xl bg-transparent">
            <div className="rounded-2xl bg-transparent px-2 sm:px-0">
              <h2 className="px-2 text-2xl font-black leading-snug tracking-tight sm:px-0 sm:text-3xl">
                {current?.prompt}
              </h2>

              <div className="mt-6 space-y-4">
                <RadioGroup
                  value={currentValue}
                  onValueChange={(value) => {
                    if (!current) return;
                    setResponses((prev) => ({ ...prev, [current.id]: value }));
                  }}
                  className="gap-4"
                >
                  {current?.answers.map((a) => {
                    const selected = currentValue === a.id;
                    return (
                      <Label
                        key={a.id}
                        className={[
                          "flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-5 py-5 text-base",
                          "shadow-sm transition-all",
                          selected ? "ring-2 ring-primary/40" : "",
                        ].join(" ")}
                      >
                        <span className="font-semibold leading-relaxed">{a.text}</span>
                        <RadioGroupItem value={a.id} aria-label={a.text} className="h-5 w-5 border-black/20" />
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" className="border-black/15 bg-white/70" onClick={goBack} disabled={stepIdx === 0}>
                  Back
                </Button>
                <Button onClick={goNext} disabled={!canGoNext} className="font-semibold">
                  Next →
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-neutral-700">Result</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">Your investor archetype</h2>
            {result ? (
              <>
                <div className="mt-5 rounded-xl border border-black/10 bg-[#fbf7f2] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">Primary profile</p>
                  <p className="mt-1 text-2xl font-black tracking-tight">{result.primary.name}</p>
                  <p className="mt-2 text-neutral-800">{result.primary.one_liner}</p>

                  {result.secondary && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">Secondary profile</p>
                      <p className="mt-1 text-lg font-black tracking-tight">{result.secondary.name}</p>
                      <p className="mt-1 text-neutral-800">{result.secondary.one_liner}</p>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-neutral-600">
                    Confidence:{" "}
                    <span className="font-semibold">
                      {result.confidence === "high" ? "high" : result.confidence === "medium" ? "medium" : "low"}
                    </span>
                  </p>
                </div>

                <p className="mt-5 text-neutral-700">
                  If you want the next step (personalized report), leave your first name and email.
                </p>
              </>
            ) : (
              <p className="mt-3 text-neutral-700">
                Result unavailable for now — scoring data is missing.
              </p>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="font-semibold">
                  First name
                </Label>
                <Input
                  id="firstName"
                  value={lead.firstName}
                  onChange={(e) => setLead((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Ex. Alex"
                  className="text-white placeholder:text-neutral-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={lead.email}
                  onChange={(e) => setLead((p) => ({ ...p, email: e.target.value }))}
                  placeholder="alex@email.com"
                  className="text-white placeholder:text-neutral-400"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                className="border-black/15 bg-white/70"
                onClick={() => setStepIdx(Math.max(0, questions.length - 1))}
              >
                Edit my answers
              </Button>
              <Button
                className="font-semibold"
                onClick={async () => {
                  if (!result) return;
                  if (!lead.firstName.trim() || !lead.email.trim()) return;

                  setIsSubmitting(true);
                  try {
                    const submit = await submitInvestisseurDiagnosticAction({
                      firstName: lead.firstName,
                      email: lead.email,
                      responses,
                    });

                    if (submit.success) {
                      setHasSubmitted(true);
                      toast.success("Thank you! Check your email to receive your report.");
                    } else {
                      toast.error(submit.error || "Error sending.");
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Error sending.");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !lead.firstName.trim() || !lead.email.trim() || !result}
              >
                {isSubmitting ? "Sending..." : "Get my report →"}
              </Button>
            </div>

            {hasSubmitted && (
              <div className="mt-5 rounded-xl border border-black/10 bg-[#fbf7f2] p-4 text-sm text-neutral-800">
                We just sent an email to <span className="font-semibold">{lead.email}</span>. If you do not see it,
                check your spam folder.
              </div>
            )}

            <p className="mt-6 text-xs text-neutral-600">
              Educational only. No personalized investment advice.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
