"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";
import { createContentItemAction } from "./content-items";

const examSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  passingScore: z.number().int().min(0).max(100).default(70),
  timeLimit: z.number().int().positive(), // in minutes
  examFormat: z.string().optional().nullable(),
  contentItemId: z.string(),
});

export type ExamActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all mock exams for a course
 */
export async function getExamsAction(courseId: string) {
  try {
    await requireAdmin();

    const exams = await prisma.quiz.findMany({
      where: {
        contentItem: {
          module: {
            courseId: courseId,
          },
        },
        isMockExam: true,
      },
      include: {
        contentItem: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        questions: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: exams };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get exams: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Erreur lors du chargement des examens",
    };
  }
}

/**
 * Create or update a mock exam
 */
export async function upsertExamAction(
  examId: string | null,
  data: z.infer<typeof examSchema>
): Promise<ExamActionResult> {
  try {
    await requireAdmin();

    const validatedData = examSchema.parse(data);

    const examData = {
      title: validatedData.title,
      passingScore: validatedData.passingScore,
      timeLimit: validatedData.timeLimit * 60, // Convert minutes to seconds
      isMockExam: true,
      examFormat: validatedData.examFormat || null,
    };

    if (examId) {
      const exam = await prisma.quiz.update({
        where: { id: examId },
        data: examData,
        include: {
          contentItem: {
            include: {
              module: true,
            },
          },
          questions: true,
        },
      });
      revalidatePath(`/tableau-de-bord/admin/courses/${exam.contentItem.module.courseId}`);
      return { success: true, data: exam };
    } else {
      // Create new exam - need to create content item first
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: validatedData.contentItemId },
        include: { module: true },
      });

      if (!contentItem) {
        return { success: false, error: "Content item introuvable" };
      }

      const exam = await prisma.quiz.create({
        data: {
          ...examData,
          contentItemId: validatedData.contentItemId,
          // Direct course link is required for efficient queries
          courseId: contentItem.module.courseId,
        },
        include: {
          contentItem: true,
          questions: true,
        },
      });

      revalidatePath(`/tableau-de-bord/admin/courses/${contentItem.module.courseId}`);
      return { success: true, data: exam };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Données invalides",
      };
    }

    await logServerError({
      errorMessage: `Failed to upsert exam: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Erreur lors de la sauvegarde de l'examen",
    };
  }
}

/**
 * Delete a mock exam
 */
export async function deleteExamAction(examId: string): Promise<ExamActionResult> {
  try {
    await requireAdmin();

    const exam = await prisma.quiz.findUnique({
      where: { id: examId },
      include: {
        contentItem: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!exam) {
      return { success: false, error: "Examen introuvable" };
    }

    await prisma.quiz.delete({
      where: { id: examId },
    });

    revalidatePath(`/dashboard/admin/courses/${exam.contentItem.module.courseId}`);
    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete exam: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Erreur lors de la suppression de l'examen",
    };
  }
}

/**
 * Upload questions to an existing exam from CSV
 */
export async function uploadQuestionsToExamAction(
  examId: string,
  csvContent: string
): Promise<ExamActionResult> {
  try {
    await requireAdmin();

    // Verify exam exists
    const exam = await prisma.quiz.findUnique({
      where: { id: examId },
      include: {
        contentItem: {
          include: {
            module: true,
          },
        },
        questions: {
          orderBy: { order: "desc" },
          take: 1,
        },
      },
    });

    if (!exam) {
      return { success: false, error: "Examen introuvable" };
    }

    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return { success: false, error: "Le fichier CSV est vide" };
    }

    // Get the next order number
    let questionOrder = exam.questions.length > 0 ? exam.questions[0].order + 1 : 1;
    const errors: string[] = [];

    // Helper function to parse CSV line
    const parseCSVLine = (line: string): string[] => {
      const fields: string[] = [];
      let currentField = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          // Remove surrounding quotes and unescape quotes
          let field = currentField.trim().replace(/^"|"$/g, "");
          // Unescape escaped single quotes: \' -> '
          field = field.replace(/\\'/g, "'");
          // Unescape escaped double quotes: \" -> "
          field = field.replace(/\\"/g, '"');
          fields.push(field);
          currentField = "";
        } else {
          currentField += char;
        }
      }
      // Process last field
      let field = currentField.trim().replace(/^"|"$/g, "");
      field = field.replace(/\\'/g, "'");
      field = field.replace(/\\"/g, '"');
      fields.push(field);
      return fields;
    };

    let currentQuestion: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCSVLine(line);
      const recordType = fields[0];

      // Check if it's a question line
      if (recordType === "question") {
        // Save previous question if exists
        if (currentQuestion && currentQuestion.correctAnswer && Object.keys(currentQuestion.options).length > 0) {
          try {
            await prisma.quizQuestion.create({
              data: {
                quizId: examId,
                question: currentQuestion.question,
                type: "MULTIPLE_CHOICE",
                order: currentQuestion.order,
                options: currentQuestion.options,
                correctAnswer: currentQuestion.correctAnswer,
              },
            });
          } catch (err) {
            errors.push(`Erreur lors de la création de la question ${currentQuestion.order}: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
          }
        }

        // Start new question
        // Format: question,"Question text","",single_choice,1.00,1,1,1,,""
        const questionText = fields[1] || "";
        const order = parseInt(fields[5] || String(questionOrder++));
        
        currentQuestion = {
          quizId: examId,
          question: questionText,
          type: "MULTIPLE_CHOICE",
          order: order,
          options: {},
          correctAnswer: "",
        };
      }
      // Check if it's an answer line
      else if (recordType === "answer") {
        if (!currentQuestion) {
          errors.push(`Ligne ${i + 1}: Réponse sans question associée`);
          continue;
        }

        // Format: answer,"Answer text",text,0,0,,1
        const answerText = fields[1] || "";
        const isCorrect = parseInt(fields[3] || "0") === 1;
        const order = parseInt(fields[6] || "1");
        const answerKey = `option${order}`;
        
        currentQuestion.options[answerKey] = answerText;

        if (isCorrect) {
          currentQuestion.correctAnswer = answerKey;
        }
      }
    }

    // Save the last question
    if (currentQuestion && currentQuestion.correctAnswer && Object.keys(currentQuestion.options).length > 0) {
      try {
        await prisma.quizQuestion.create({
          data: {
            quizId: examId,
            question: currentQuestion.question,
            type: "MULTIPLE_CHOICE",
            order: currentQuestion.order,
            options: currentQuestion.options,
            correctAnswer: currentQuestion.correctAnswer,
          },
        });
      } catch (err) {
        errors.push(`Erreur lors de la création de la dernière question: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
      }
    }

    revalidatePath(`/dashboard/admin/courses/${exam.contentItem.module.courseId}`);
    return {
      success: true,
      data: {
        questionsAdded: questionOrder - 1,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload questions to exam: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de l'upload: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Clean up escaped quotes in existing exam questions
 */
export async function cleanupEscapedQuotesAction(examId: string): Promise<ExamActionResult> {
  try {
    await requireAdmin();

    const exam = await prisma.quiz.findUnique({
      where: { id: examId },
      include: {
        contentItem: {
          include: {
            module: true,
          },
        },
        questions: true,
      },
    });

    if (!exam) {
      return { success: false, error: "Examen introuvable" };
    }

    let updatedCount = 0;

    for (const question of exam.questions) {
      let needsUpdate = false;
      const updates: any = {};

      // Clean up question text
      if (question.question.includes("\\'")) {
        updates.question = question.question.replace(/\\'/g, "'");
        needsUpdate = true;
      }

      // Clean up options
      if (question.options && typeof question.options === 'object' && !Array.isArray(question.options)) {
        const cleanedOptions: Record<string, string> = {};
        let optionsChanged = false;
        
        for (const [key, value] of Object.entries(question.options)) {
          if (typeof value === "string") {
            if (value.includes("\\'")) {
              cleanedOptions[key] = value.replace(/\\'/g, "'");
              optionsChanged = true;
            } else {
              cleanedOptions[key] = value;
            }
          } else if (value != null) {
            // Defensive: options should be strings, but Prisma JSON can be wider.
            cleanedOptions[key] = String(value);
          }
        }

        if (optionsChanged) {
          updates.options = cleanedOptions;
          needsUpdate = true;
        }
      }

      // Clean up correct answer
      if (question.correctAnswer && question.correctAnswer.includes("\\'")) {
        updates.correctAnswer = question.correctAnswer.replace(/\\'/g, "'");
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.quizQuestion.update({
          where: { id: question.id },
          data: updates,
        });
        updatedCount++;
      }
    }

    // Only revalidate if we have the courseId
    if (exam.contentItem?.module?.courseId) {
      revalidatePath(`/tableau-de-bord/admin/courses/${exam.contentItem.module.courseId}`);
    }
    
    return {
      success: true,
      data: { updatedCount },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to cleanup escaped quotes: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: `Erreur lors du nettoyage: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}

/**
 * Import practice exam from CSV format: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
 */
export async function importPracticeExamFromCSVAction(
  courseId: string,
  csvContent: string,
  examTitle?: string,
  moduleId?: string | null,
  existingExamId?: string | null
): Promise<ExamActionResult> {
  try {
    await requireAdmin();

    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      return { success: false, error: "Le fichier CSV doit contenir au moins un en-tête et une question" };
    }

    // Parse CSV line helper
    const parseCSVLine = (line: string): string[] => {
      const fields: string[] = [];
      let currentField = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          let field = currentField.trim().replace(/^"|"$/g, "");
          field = field.replace(/\\'/g, "'");
          field = field.replace(/\\"/g, '"');
          fields.push(field);
          currentField = "";
        } else {
          currentField += char;
        }
      }
      // Process last field
      let field = currentField.trim().replace(/^"|"$/g, "");
      field = field.replace(/\\'/g, "'");
      field = field.replace(/\\"/g, '"');
      fields.push(field);
      return fields;
    };

    // Parse header
    const header = parseCSVLine(lines[0]);
    const expectedHeader = ["id", "chapter", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"];
    
    // Check if header matches expected format (case-insensitive)
    const headerLower = header.map(h => h.toLowerCase().trim());
    const hasRequiredFields = expectedHeader.every(field => headerLower.includes(field));
    
    if (!hasRequiredFields) {
      return { 
        success: false, 
        error: `Format CSV invalide. En-têtes attendus: ${expectedHeader.join(", ")}` 
      };
    }

    // Get column indices
    const getColumnIndex = (name: string): number => {
      const idx = headerLower.indexOf(name.toLowerCase().trim());
      return idx >= 0 ? idx : -1;
    };

    const questionIdx = getColumnIndex("question");
    const optionAIdx = getColumnIndex("option_a");
    const optionBIdx = getColumnIndex("option_b");
    const optionCIdx = getColumnIndex("option_c");
    const optionDIdx = getColumnIndex("option_d");
    const correctOptionIdx = getColumnIndex("correct_option");
    const explanationIdx = getColumnIndex("explanation");

    if (questionIdx === -1 || optionAIdx === -1 || optionBIdx === -1 || correctOptionIdx === -1) {
      return { 
        success: false, 
        error: "Colonnes requises manquantes: question, option_a, option_b, correct_option" 
      };
    }

    // Parse questions
    const questions: Array<{
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCSVLine(line);
      
      const questionText = fields[questionIdx]?.trim();
      if (!questionText) continue;

      const optionA = fields[optionAIdx]?.trim() || "";
      const optionB = fields[optionBIdx]?.trim() || "";
      const optionC = fields[optionCIdx]?.trim() || "";
      const optionD = fields[optionDIdx]?.trim() || "";

      if (!optionA || !optionB) {
        continue; // Skip questions without at least A and B
      }

      const correctOption = fields[correctOptionIdx]?.trim().toUpperCase();
      const explanation = fields[explanationIdx]?.trim() || undefined;

      // Map options: A -> option1, B -> option2, etc.
      const options: Record<string, string> = {
        option1: optionA,
        option2: optionB,
      };

      if (optionC) options.option3 = optionC;
      if (optionD) options.option4 = optionD;

      // Map correct answer
      const correctAnswerMap: Record<string, string> = {
        A: "option1",
        B: "option2",
        C: "option3",
        D: "option4",
      };

      const correctAnswer = correctAnswerMap[correctOption] || "option1";

      if (!options[correctAnswer]) {
        continue; // Skip if correct answer doesn't match any option
      }

      questions.push({
        question: questionText,
        options,
        correctAnswer,
        explanation,
      });
    }

    if (questions.length === 0) {
      return { success: false, error: "Aucune question valide trouvée dans le fichier CSV" };
    }

    let exam;
    let contentItem;

    if (existingExamId) {
      // Use existing exam
      exam = await prisma.quiz.findUnique({
        where: { id: existingExamId },
        include: { contentItem: true },
      });

      if (!exam) {
        return { success: false, error: "Examen introuvable" };
      }

      contentItem = exam.contentItem;
    } else {
      // Create new exam
      let targetModuleId = moduleId;
      
      if (!targetModuleId) {
        const firstModule = await prisma.module.findFirst({
          where: { courseId },
          orderBy: { order: "asc" },
        });

        if (!firstModule) {
          return { success: false, error: "Aucun module trouvé pour ce cours" };
        }

        targetModuleId = firstModule.id;
      }

      // Create content item
      const contentItemResult = await createContentItemAction({
        moduleId: targetModuleId,
        contentType: "QUIZ",
        order: 0,
      });

      if (!contentItemResult.success || !contentItemResult.data) {
        return {
          success: false,
          error: contentItemResult.error || "Erreur lors de la création de l'élément de contenu",
        };
      }

      contentItem = contentItemResult.data;

      // Create exam
      exam = await prisma.quiz.create({
        data: {
          contentItemId: contentItem.id,
          courseId, // Direct course link for efficient queries
          title: examTitle || `Examen pratique - ${new Date().toLocaleDateString()}`,
          passingScore: 70,
          timeLimit: 120 * 60, // 120 minutes in seconds
          isMockExam: true,
        },
        include: {
          contentItem: true,
        },
      });
    }

    // Get next order number
    const lastQuestion = await prisma.quizQuestion.findFirst({
      where: { quizId: exam.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    let nextOrder = lastQuestion ? lastQuestion.order + 1 : 1;

    // Import questions
    const errors: string[] = [];
    let successCount = 0;

    for (const q of questions) {
      try {
        await prisma.quizQuestion.create({
          data: {
            quizId: exam.id,
            question: q.question,
            type: "MULTIPLE_CHOICE",
            order: nextOrder++,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
          },
        });
        successCount++;
      } catch (err) {
        errors.push(`Erreur lors de la création de la question: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
      }
    }

    revalidatePath(`/tableau-de-bord/admin/courses/${courseId}`);
    revalidatePath(`/dashboard/admin/courses/${courseId}`);

    return {
      success: true,
      data: {
        examId: exam.id,
        questionsAdded: successCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to import practice exam: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de l'importation: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
    };
  }
}


