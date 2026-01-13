"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export type CaseStudyActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

const caseStudySchema = z.object({
  courseId: z.string(),
  caseId: z.string(),
  caseNumber: z.number().int().positive(),
  title: z.string().min(1),
  theme: z.string().optional().nullable(),
  narrative: z.any(), // JSON structure
  chapters: z.array(z.number().int()),
  passingScore: z.number().int().min(0).max(100).default(70),
});

const caseStudyQuestionSchema = z.object({
  questionId: z.string(),
  order: z.number().int().positive(),
  question: z.string().min(1),
  options: z.record(z.string(), z.string()),
  correctAnswer: z.string(),
  explanation: z.string().optional().nullable(),
  questionType: z.string().optional().nullable(),
  difficulty: z.string().optional().nullable(),
  chapterReference: z.array(z.number()).optional().nullable(),
  caseReference: z.string().optional().nullable(),
  calculationSteps: z.string().optional().nullable(),
});

/**
 * Import case study from JSON files (narrative + MCQ)
 */
export async function importCaseStudyAction(
  courseId: string,
  narrativeJson: string,
  mcqJson: string
): Promise<CaseStudyActionResult> {
  try {
    await requireAdmin();

    let narrativeData: any;
    let mcqData: any;

    try {
      narrativeData = JSON.parse(narrativeJson);
      mcqData = JSON.parse(mcqJson);
    } catch (error) {
      return {
        success: false,
        error: "Erreur lors du parsing des fichiers JSON",
      };
    }

    // Validate case_id match
    if (narrativeData.case_id !== mcqData.case_id) {
      return {
        success: false,
        error: `Les case_id ne correspondent pas: ${narrativeData.case_id} vs ${mcqData.case_id}`,
      };
    }

    const caseId = narrativeData.case_id;
    const caseNumber = narrativeData.case_number || parseInt(narrativeData.narrative?.case_narrative?.title?.match(/cas\s+(\d+)/i)?.[1] || "1", 10);
    const title = narrativeData.narrative?.case_narrative?.title || `Étude de cas ${caseNumber}`;
    const theme = narrativeData.narrative?.case_narrative?.theme || null;
    const chapters = narrativeData.chapters || [];
    const narrative = narrativeData.narrative || narrativeData;
    const questions = mcqData.questions || [];

    if (questions.length !== 10) {
      return {
        success: false,
        error: `Un cas doit contenir exactement 10 questions. Trouvé: ${questions.length}`,
      };
    }

    // Check if case study already exists
    const existing = await prisma.caseStudy.findUnique({
      where: { caseId },
    });

    if (existing) {
      return {
        success: false,
        error: `Un cas avec l'ID ${caseId} existe déjà`,
      };
    }

    // Create case study
    const caseStudy = await prisma.caseStudy.create({
      data: {
        courseId,
        caseId,
        caseNumber: typeof caseNumber === "string" ? parseInt(caseNumber, 10) : caseNumber,
        title,
        theme,
        narrative,
        chapters,
        passingScore: 70,
      },
    });

    // Create questions
    const questionPromises = questions.map((q: any, index: number) => {
      const options: Record<string, string> = {};
      if (q.options) {
        Object.entries(q.options).forEach(([key, value]) => {
          options[key] = String(value);
        });
      }

      return prisma.caseStudyQuestion.create({
        data: {
          caseStudyId: caseStudy.id,
          questionId: q.id || `Q${index + 1}`,
          order: index + 1,
          question: q.question,
          options,
          correctAnswer: q.correct_answer || q.correctAnswer,
          explanation: q.explanation || null,
          questionType: q.type || null,
          difficulty: q.difficulty || null,
          chapterReference: q.chapter_reference || q.chapterReference || null,
          caseReference: q.case_reference || q.caseReference || null,
          calculationSteps: q.calculation_steps || q.calculationSteps || null,
        },
      });
    });

    await Promise.all(questionPromises);

    revalidatePath(`/tableau-de-bord/admin/courses/${courseId}`);
    revalidatePath(`/dashboard/admin/courses/${courseId}`);

    return {
      success: true,
      data: {
        caseStudyId: caseStudy.id,
        questionsCreated: questions.length,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to import case study: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de l'importation: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Get all case studies for a course
 * Can be called by both admins and authenticated users
 */
export async function getCaseStudiesAction(courseId: string): Promise<CaseStudyActionResult> {
  try {
    // Allow both admin and authenticated users
    try {
      await requireAdmin();
    } catch {
      // If not admin, require at least authentication
      await requireAuth();
    }

    const caseStudies = await prisma.caseStudy.findMany({
      where: { courseId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
      },
      orderBy: { caseNumber: "asc" },
    });

    return { success: true, data: caseStudies };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if it's a Prisma client issue
    if (errorMessage.includes("caseStudy") || errorMessage.includes("Cannot read property") || errorMessage.includes("is not a function")) {
      await logServerError({
        errorMessage: `Prisma client not regenerated. Failed to get case studies: ${errorMessage}`,
        stackTrace: errorStack,
        severity: "HIGH",
      });
      
      return {
        success: false,
        error: "Le client Prisma doit être régénéré. Veuillez arrêter le serveur de développement, exécuter 'npx prisma generate', puis redémarrer le serveur.",
      };
    }
    
    await logServerError({
      errorMessage: `Failed to get case studies: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "MEDIUM",
    });

    console.error("Case studies error details:", error);
    
    return {
      success: false,
      error: `Erreur lors du chargement des études de cas: ${errorMessage}`,
    };
  }
}

/**
 * Get a single case study with questions
 */
export async function getCaseStudyAction(caseStudyId: string): Promise<CaseStudyActionResult> {
  try {
    await requireAuth();

    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id: caseStudyId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!caseStudy) {
      return { success: false, error: "Étude de cas introuvable" };
    }

    return { success: true, data: caseStudy };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get case study: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement de l'étude de cas",
    };
  }
}

/**
 * Update case study metadata (title, theme, passing score)
 */
export async function updateCaseStudyAction(
  caseStudyId: string,
  data: {
    title?: string;
    theme?: string | null;
    passingScore?: number;
    narrative?: any;
  }
): Promise<CaseStudyActionResult> {
  try {
    await requireAdmin();

    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id: caseStudyId },
    });

    if (!caseStudy) {
      return { success: false, error: "Étude de cas introuvable" };
    }

    const updated = await prisma.caseStudy.update({
      where: { id: caseStudyId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
        ...(data.narrative !== undefined && { narrative: data.narrative }),
      },
    });

    revalidatePath(`/tableau-de-bord/admin/courses/${caseStudy.courseId}`);
    revalidatePath(`/dashboard/admin/courses/${caseStudy.courseId}`);

    return { success: true, data: updated };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update case study: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la mise à jour",
    };
  }
}

/**
 * Update a case study question
 */
export async function updateCaseStudyQuestionAction(
  questionId: string,
  data: {
    question?: string;
    options?: Record<string, string>;
    correctAnswer?: string;
    explanation?: string | null;
    questionType?: string | null;
    difficulty?: string | null;
    chapterReference?: number[] | null;
    caseReference?: string | null;
    calculationSteps?: string | null;
  }
): Promise<CaseStudyActionResult> {
  try {
    await requireAdmin();

    const question = await prisma.caseStudyQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return { success: false, error: "Question introuvable" };
    }

    const updated = await prisma.caseStudyQuestion.update({
      where: { id: questionId },
      data: {
        ...(data.question !== undefined && { question: data.question }),
        ...(data.options !== undefined && { options: data.options }),
        ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
        ...(data.explanation !== undefined && { explanation: data.explanation }),
        ...(data.questionType !== undefined && { questionType: data.questionType }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.chapterReference !== undefined && { 
          chapterReference: data.chapterReference === null ? Prisma.JsonNull : data.chapterReference 
        }),
        ...(data.caseReference !== undefined && { caseReference: data.caseReference }),
        ...(data.calculationSteps !== undefined && { calculationSteps: data.calculationSteps }),
      },
    });

    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id: question.caseStudyId },
      select: { courseId: true },
    });

    if (caseStudy) {
      revalidatePath(`/tableau-de-bord/admin/courses/${caseStudy.courseId}`);
      revalidatePath(`/dashboard/admin/courses/${caseStudy.courseId}`);
    }

    return { success: true, data: updated };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to update case study question: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la mise à jour de la question",
    };
  }
}

/**
 * Delete a case study question
 */
export async function deleteCaseStudyQuestionAction(questionId: string): Promise<CaseStudyActionResult> {
  try {
    await requireAdmin();

    const question = await prisma.caseStudyQuestion.findUnique({
      where: { id: questionId },
      include: {
        caseStudy: {
          select: { courseId: true },
        },
      },
    });

    if (!question) {
      return { success: false, error: "Question introuvable" };
    }

    await prisma.caseStudyQuestion.delete({
      where: { id: questionId },
    });

    revalidatePath(`/tableau-de-bord/admin/courses/${question.caseStudy.courseId}`);
    revalidatePath(`/dashboard/admin/courses/${question.caseStudy.courseId}`);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete case study question: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la suppression de la question",
    };
  }
}

/**
 * Delete a case study
 */
export async function deleteCaseStudyAction(caseStudyId: string): Promise<CaseStudyActionResult> {
  try {
    await requireAdmin();

    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id: caseStudyId },
      select: { courseId: true },
    });

    if (!caseStudy) {
      return { success: false, error: "Étude de cas introuvable" };
    }

    await prisma.caseStudy.delete({
      where: { id: caseStudyId },
    });

    revalidatePath(`/tableau-de-bord/admin/courses/${caseStudy.courseId}`);
    revalidatePath(`/dashboard/admin/courses/${caseStudy.courseId}`);

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete case study: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la suppression",
    };
  }
}

/**
 * Submit case study attempt
 */
export async function submitCaseStudyAction(
  caseStudyId: string,
  answers: Record<string, string>
): Promise<CaseStudyActionResult> {
  try {
    const user = await requireAuth();

    const caseStudy = await prisma.caseStudy.findUnique({
      where: { id: caseStudyId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!caseStudy) {
      return { success: false, error: "Étude de cas introuvable" };
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = caseStudy.questions.length;

    caseStudy.questions.forEach((question) => {
      const userAnswer = answers[question.id];
      if (userAnswer && userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()) {
        correctAnswers++;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= caseStudy.passingScore;

    // Create attempt
    const attempt = await prisma.caseStudyAttempt.create({
      data: {
        userId: user.id,
        caseStudyId: caseStudy.id,
        score,
        passed,
        answers,
        answersRevealed: false,
      },
    });

    return {
      success: true,
      data: {
        attempt,
        attemptId: attempt.id,
        score,
        passingScore: caseStudy.passingScore,
        passed,
        correctAnswers,
        totalQuestions,
        userAnswers: answers,
        questions: caseStudy.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
        })),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to submit case study: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de la soumission: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Reveal answers for a case study attempt
 */
export async function revealCaseStudyAnswersAction(attemptId: string): Promise<CaseStudyActionResult> {
  try {
    const user = await requireAuth();

    const attempt = await prisma.caseStudyAttempt.findUnique({
      where: { id: attemptId },
      include: {
        caseStudy: {
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!attempt) {
      return { success: false, error: "Tentative introuvable" };
    }

    if (attempt.userId !== user.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Update attempt to mark answers as revealed
    await prisma.caseStudyAttempt.update({
      where: { id: attemptId },
      data: {
        answersRevealed: true,
      },
    });

    return {
      success: true,
      data: {
        questions: attempt.caseStudy.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
        })),
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to reveal case study answers: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors de la révélation des réponses",
    };
  }
}

/**
 * Get user's attempts for a case study
 */
export async function getCaseStudyAttemptsAction(
  caseStudyId: string
): Promise<CaseStudyActionResult> {
  try {
    const user = await requireAuth();

    const attempts = await prisma.caseStudyAttempt.findMany({
      where: {
        caseStudyId,
        userId: user.id,
      },
      orderBy: { completedAt: "desc" },
    });

    return { success: true, data: attempts };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get case study attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement des tentatives",
    };
  }
}
