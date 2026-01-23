"use server";

import { z } from "zod";
import { sendInvestorDiagnosticCompletedWebhook } from "@/lib/webhooks/make";
import { computeInvestisseurResult, INVESTISSEUR_DIAGNOSTIC_META } from "@/lib/constants/investor-diagnostic";
import { prisma } from "@/lib/prisma";
import { generateInvestorReport } from "@/lib/reports/investor/generate-investor-report";
import crypto from "crypto";

const submitInvestisseurDiagnosticSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(100, "First name too long"),
  email: z.string().trim().email("Invalid email").max(200, "Email too long"),
  responses: z
    .record(z.string(), z.string().min(1))
    .refine((r) => Object.keys(r).length > 0, "Answers required"),
});

export type SubmitInvestisseurDiagnosticResult =
  | { success: true }
  | { success: false; error: string };

export async function submitInvestisseurDiagnosticAction(
  data: z.input<typeof submitInvestisseurDiagnosticSchema>
): Promise<SubmitInvestisseurDiagnosticResult> {
  try {
    const parsed = submitInvestisseurDiagnosticSchema.parse(data);

    const result = computeInvestisseurResult(parsed.responses);
    if (!result) {
      return { success: false, error: "Unable to calculate the quiz result." };
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.URL || // Netlify
      "http://localhost:3000";

    const reportToken = crypto.randomUUID();
    const reportTemplateId = "investor_report_v1";
    const reportTemplateVersion = "1.0.0";
    const reportUrl = `${baseUrl.replace(/\/$/, "")}/r/${reportToken}`;

    const nowIso = new Date().toISOString();

    const created = await prisma.$transaction(async (tx) => {
      const lead = await tx.investorLead.upsert({
        where: { email: parsed.email.toLowerCase() },
        update: {
          firstName: parsed.firstName,
        },
        create: {
          email: parsed.email.toLowerCase(),
          firstName: parsed.firstName,
        },
      });

      const assessment = await tx.investorAssessment.create({
        data: {
          leadId: lead.id,
          diagnosticId: INVESTISSEUR_DIAGNOSTIC_META.diagnosticId || "diagnostic_investisseur_v1",
          diagnosticVersion: INVESTISSEUR_DIAGNOSTIC_META.version || "1.0.0",
          language: INVESTISSEUR_DIAGNOSTIC_META.language || "fr-CA",
          responses: parsed.responses,
          scores: result.scores,
          primaryId: result.primary.id,
          secondaryId: result.secondary?.id ?? null,
          confidence: result.confidence,
        },
      });

      const generated = generateInvestorReport({
        firstName: parsed.firstName,
        email: parsed.email,
        responses: parsed.responses,
        result,
        reportVersion: reportTemplateVersion,
      });

      const report = await tx.investorReportInstance.create({
        data: {
          assessmentId: assessment.id,
          templateId: reportTemplateId,
          templateVersion: reportTemplateVersion,
          renderedMd: generated.renderedMd,
          token: reportToken,
          renderedAt: new Date(nowIso),
          // expiresAt: null, // optional: add later if needed
        },
      });

      return { lead, assessment, report };
    });

    await sendInvestorDiagnosticCompletedWebhook({
      diagnosticId: INVESTISSEUR_DIAGNOSTIC_META.diagnosticId || "diagnostic_investisseur_v1",
      diagnosticVersion: INVESTISSEUR_DIAGNOSTIC_META.version || "1.0.0",
      language: INVESTISSEUR_DIAGNOSTIC_META.language || "fr-CA",
      firstName: parsed.firstName,
      email: parsed.email,
      reportUrl,
      reportToken: created.report.token,
      reportTemplateId,
      reportTemplateVersion,
      responses: parsed.responses,
      scores: result.scores,
      primaryProfile: { id: result.primary.id, name: result.primary.name, score: result.primary.score },
      secondaryProfile: result.secondary
        ? { id: result.secondary.id, name: result.secondary.name, score: result.secondary.score }
        : null,
      confidence: result.confidence,
      completedAt: nowIso,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "Invalid data" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}


