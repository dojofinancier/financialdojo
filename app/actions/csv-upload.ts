"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";
import { createContentItemAction } from "@/app/actions/content-items";

export type CSVUploadResult = {
  success: boolean;
  error?: string;
  data?: {
    quizzesCreated?: number;
    flashcardsCreated?: number;
    errors?: string[];
  };
};

/**
 * Parse quiz/exam CSV format
 * Format: settings,"Title","",0,minutes,1,10,60,50,,,rand,,200
 *         question,"Question text","",single_choice,points,order,?,?,,""
 *         answer,"Answer text",text,is_correct(0/1),0,,order
 */
export async function uploadQuizCSVAction(
  courseId: string,
  moduleId: string | null,
  csvContent: string,
  isMockExam: boolean = false
): Promise<CSVUploadResult> {
  try {
    await requireAdmin();

    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return { success: false, error: "Le fichier CSV est vide" };
    }

    // Parse settings line - format: settings,"Title","",0,minutes,1,10,60,50,,,rand,,200
    const settingsLine = lines[0];
    // Split by comma but respect quoted fields
    const settingsFields: string[] = [];
    let currentField = "";
    let inQuotes = false;
    
    for (let j = 0; j < settingsLine.length; j++) {
      const char = settingsLine[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        settingsFields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    settingsFields.push(currentField.trim());
    
    if (settingsFields.length < 9 || settingsFields[0] !== "settings") {
      return { success: false, error: "Invalid file format: missing or incorrect settings line" };
    }

    // Parse settings: settings,"Title","",0,minutes,1,10,60,50
    // Index: 0=settings, 1=title, 7=timeLimitMinutes, 8=passingScore
    const title = settingsFields[1]?.replace(/^"|"$/g, "") || (isMockExam ? "Mock exam" : "Quiz");
    const timeLimitMinutes = parseInt(settingsFields[7] || "60");
    const passingScore = parseInt(settingsFields[8] || "70");
    const timeLimitSeconds = timeLimitMinutes * 60;
    const passingScoreInt = passingScore || 70;

    // Create content item for the quiz/exam
    let contentItem;
    let targetModuleId = moduleId;
    
    if (!targetModuleId) {
      // Find first module or create a default one
      const firstModule = await prisma.module.findFirst({
        where: { courseId },
        orderBy: { order: "asc" },
      });

      if (!firstModule) {
        return { success: false, error: "No modules found for this course" };
      }

      targetModuleId = firstModule.id;
    }

    // Use createContentItemAction to handle order assignment automatically
    const contentItemResult = await createContentItemAction({
      moduleId: targetModuleId,
      contentType: "QUIZ",
      order: 0, // Will be automatically adjusted if order 0 already exists
    });

    if (!contentItemResult.success || !contentItemResult.data) {
      return {
        success: false,
        error: contentItemResult.error || "Error creating the content item",
      };
    }

    contentItem = contentItemResult.data;

    // Create quiz/exam
    const quiz = await prisma.quiz.create({
      data: {
        contentItemId: contentItem.id,
        courseId, // Direct course link for efficient queries
        title: title || (isMockExam ? "Mock exam" : "Quiz"),
        passingScore: passingScoreInt,
        timeLimit: timeLimitSeconds,
        isMockExam,
      },
    });

    // Parse questions and answers
    let currentQuestion: any = null;
    let questionOrder = 1;
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

    for (let i = 1; i < lines.length; i++) {
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
                quizId: currentQuestion.quizId,
                question: currentQuestion.question,
                type: currentQuestion.type,
                order: currentQuestion.order,
                options: currentQuestion.options,
                correctAnswer: currentQuestion.correctAnswer,
              },
            });
          } catch (err) {
            errors.push(`Error creating question ${currentQuestion.order}: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }

        // Start new question
        // Format: question,"Question text","",single_choice,1.00,1,1,1,,""
        // Index: 0=question, 1=questionText, 5=order
        const questionText = fields[1] || "";
        const order = parseInt(fields[5] || String(questionOrder++));
        
        currentQuestion = {
          quizId: quiz.id,
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
          errors.push(`Line ${i + 1}: Answer without an associated question`);
          continue;
        }

        // Format: answer,"Answer text",text,0,0,,1
        // Index: 0=answer, 1=answerText, 3=isCorrect (0 or 1), 6=order
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
            quizId: currentQuestion.quizId,
            question: currentQuestion.question,
            type: currentQuestion.type,
            order: currentQuestion.order,
            options: currentQuestion.options,
            correctAnswer: currentQuestion.correctAnswer,
          },
        });
      } catch (err) {
        errors.push(`Error creating the last question: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return {
      success: true,
      data: {
        quizzesCreated: 1,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload quiz CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error during upload: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Parse flashcard CSV format
 * Format: ID,Title,Question,Answer,Chapter
 */
export async function uploadFlashcardCSVAction(
  courseId: string,
  csvContent: string
): Promise<CSVUploadResult> {
  try {
    await requireAdmin();

    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      return { success: false, error: "The CSV file must contain at least one header and one row of data" };
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim());
    const idIndex = header.indexOf("ID");
    const titleIndex = header.indexOf("Title");
    const questionIndex = header.indexOf("Question");
    const answerIndex = header.indexOf("Answer");
    const chapterIndex = header.indexOf("Chapter");

    if (questionIndex === -1 || answerIndex === -1) {
      return { success: false, error: "The CSV file must contain the 'Question' and 'Answer' columns" };
    }

    // Get modules to map chapters
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
    });

    let flashcardsCreated = 0;
    const errors: string[] = [];

    // First pass: Find minimum chapter number to determine offset
    let minChapter: number | null = null;
    if (chapterIndex !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handling quoted fields)
        const fields: string[] = [];
        let currentField = "";
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            fields.push(currentField.trim());
            currentField = "";
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim());

        const chapter = parseInt(fields[chapterIndex] || "0");
        if (!isNaN(chapter) && chapter > 0) {
          if (minChapter === null || chapter < minChapter) {
            minChapter = chapter;
          }
        }
      }
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handling quoted fields)
      const fields: string[] = [];
      let currentField = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          fields.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim()); // Add last field

      const question = fields[questionIndex]?.replace(/^"|"$/g, "") || "";
      const answer = fields[answerIndex]?.replace(/^"|"$/g, "") || "";
      const chapter = chapterIndex !== -1 ? parseInt(fields[chapterIndex] || "0") : null;

      if (!question || !answer) {
        errors.push(`Line ${i + 1}: Question or answer missing`);
        continue;
      }

      // Map chapter to module
      // If minChapter is found, use it as offset (e.g., chapters 13-27 map to modules 0-14)
      // Otherwise, assume chapters start at 1 (e.g., chapters 1-15 map to modules 0-14)
      let moduleId: string | null = null;
      if (chapter !== null && chapter > 0 && modules.length > 0) {
        const offset = minChapter !== null ? minChapter : 1;
        const moduleIndex = Math.min(Math.max(0, chapter - offset), modules.length - 1);
        moduleId = modules[moduleIndex].id;
      }

      try {
        await prisma.flashcard.create({
          data: {
            courseId,
            front: question,
            back: answer,
            moduleId,
          },
        });
        flashcardsCreated++;
      } catch (err) {
        errors.push(`Ligne ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return {
      success: true,
      data: {
        flashcardsCreated,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload flashcard CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error during upload: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
