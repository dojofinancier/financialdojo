"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { z } from "zod";

const questionBankSchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
});

const questionSchema = z.object({
  questionBankId: z.string().min(1),
  question: z.string().min(1),
  options: z.record(z.string(), z.string()), // { "A": "...", "B": "...", ... }
  correctAnswer: z.string().min(1), // "A", "B", etc.
  explanation: z.string().optional().nullable(),
  order: z.number().int().nonnegative(),
});

export type QuestionBankResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Get all question banks for a course
 */
export async function getQuestionBanksAction(
  courseId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const questionBanks = await prisma.questionBank.findMany({
      where: { courseId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: questionBanks };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get question banks: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading question banks",
      data: [],
    };
  }
}

/**
 * Create a question bank
 */
export async function createQuestionBankAction(
  data: z.infer<typeof questionBankSchema>
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const validatedData = questionBankSchema.parse(data);

    const questionBank = await prisma.questionBank.create({
      data: {
        courseId: validatedData.courseId,
        moduleId: validatedData.moduleId || null,
        title: validatedData.title,
        description: validatedData.description || null,
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    return { success: true, data: questionBank };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to create question bank: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error creating the question bank",
    };
  }
}

/**
 * Update a question bank
 */
export async function updateQuestionBankAction(
  questionBankId: string,
  data: Partial<z.infer<typeof questionBankSchema>>
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const updateSchema = questionBankSchema.partial();
    const validatedData = updateSchema.parse(data);

    const questionBank = await prisma.questionBank.update({
      where: { id: questionBankId },
      data: {
        ...(validatedData.moduleId !== undefined && { moduleId: validatedData.moduleId || null }),
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.description !== undefined && { description: validatedData.description || null }),
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            questions: true,
          },
        },
      },
    });

    return { success: true, data: questionBank };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to update question bank: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error updating the question bank",
    };
  }
}

/**
 * Delete a question bank
 */
export async function deleteQuestionBankAction(
  questionBankId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    await prisma.questionBank.delete({
      where: { id: questionBankId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete question bank: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error deleting the question bank",
    };
  }
}

/**
 * Add a question to a question bank
 */
export async function addQuestionToBankAction(
  data: z.infer<typeof questionSchema>
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const validatedData = questionSchema.parse(data);

    // Get the next order number for this question bank
    const lastQuestion = await prisma.questionBankQuestion.findFirst({
      where: { questionBankId: validatedData.questionBankId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

    const question = await prisma.questionBankQuestion.create({
      data: {
        questionBankId: validatedData.questionBankId,
        question: validatedData.question,
        options: validatedData.options,
        correctAnswer: validatedData.correctAnswer,
        explanation: validatedData.explanation || null,
        order: validatedData.order !== undefined ? validatedData.order : nextOrder,
      },
    });

    return { success: true, data: question };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to add question to bank: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error adding the question",
    };
  }
}

/**
 * Update a question in a question bank
 */
export async function updateQuestionInBankAction(
  questionId: string,
  data: Partial<Omit<z.infer<typeof questionSchema>, "questionBankId" | "order">>
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    // Create a more flexible update schema
    const updateSchema = z.object({
      question: z.string().min(1).optional(),
      options: z.record(z.string(), z.string()).optional(),
      correctAnswer: z.string().min(1).optional(),
      explanation: z.string().nullable().optional(),
    });

    const validatedData = updateSchema.parse(data);

    // Validate that if options are provided, they're not empty
    if (validatedData.options !== undefined && Object.keys(validatedData.options).length === 0) {
      return {
        success: false,
        error: "Options cannot be empty",
      };
    }

    // Validate that correctAnswer exists in options if both are provided
    if (validatedData.options && validatedData.correctAnswer) {
      if (!validatedData.options[validatedData.correctAnswer]) {
        return {
          success: false,
          error: "The correct answer must correspond to a valid option",
        };
      }
    }

    const question = await prisma.questionBankQuestion.update({
      where: { id: questionId },
      data: {
        ...(validatedData.question !== undefined && { question: validatedData.question }),
        ...(validatedData.options !== undefined && { options: validatedData.options }),
        ...(validatedData.correctAnswer !== undefined && { correctAnswer: validatedData.correctAnswer }),
        ...(validatedData.explanation !== undefined && { explanation: validatedData.explanation || null }),
      },
    });

    return { success: true, data: question };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      console.error("Zod validation error:", errorDetails);
      return {
        success: false,
        error: `Invalid data: ${errorDetails}`,
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error updating question:", errorMessage, errorStack);

    await logServerError({
      errorMessage: `Failed to update question: ${errorMessage}`,
      stackTrace: errorStack,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error updating the question: ${errorMessage}`,
    };
  }
}

/**
 * Delete a question from a question bank
 */
export async function deleteQuestionFromBankAction(
  questionId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    await prisma.questionBankQuestion.delete({
      where: { id: questionId },
    });

    return { success: true };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to delete question: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: "Error while deleting the question",
    };
  }
}

/**
 * Upload questions from CSV file
 */
export async function uploadQuestionsFromCSVAction(
  questionBankId: string,
  csvContent: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    // Parse CSV content
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return {
        success: false,
        error: "The CSV file is empty",
      };
    }

    const questions: Array<{
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string;
    }> = [];

    let currentQuestion: {
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string;
    } | null = null;

    // Parse CSV lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Parse CSV line (handle quoted fields with commas)
      const fields = parseCSVLine(line);

      if (fields.length === 0) continue;

      const rowType = fields[0]?.toLowerCase().trim();

      if (rowType === "settings") {
        // Skip settings row
        continue;
      } else if (rowType === "question") {
        // Save previous question if exists
        if (currentQuestion) {
          questions.push(currentQuestion);
        }

        // Start new question
        const questionText = fields[1]?.trim() || "";
        if (questionText) {
          currentQuestion = {
            question: questionText,
            options: {},
            correctAnswer: "",
          };
        }
      } else if (rowType === "answer" && currentQuestion) {
        const answerText = fields[1]?.trim() || "";
        const isCorrect = fields[3] === "1" || fields[3] === "true";
        const order = parseInt(fields[6] || "0", 10);

        if (answerText) {
          // Use order (1, 2, 3, 4) to determine option letter (A, B, C, D)
          // Order is 1-indexed, so 1 -> A (65), 2 -> B (66), etc.
          if (order > 0 && order <= 26) {
            const optionLetter = String.fromCharCode(64 + order); // 1 -> A, 2 -> B, etc.
            currentQuestion.options[optionLetter] = answerText;

            if (isCorrect) {
              currentQuestion.correctAnswer = optionLetter;
            }
          } else {
            // Fallback: use sequential letters if order is invalid
            const optionLetters = Object.keys(currentQuestion.options);
            const nextLetter = String.fromCharCode(65 + optionLetters.length); // A, B, C, D...
            currentQuestion.options[nextLetter] = answerText;

            if (isCorrect) {
              currentQuestion.correctAnswer = nextLetter;
            }
          }
        }
      }
    }

    // Add last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    if (questions.length === 0) {
      return {
        success: false,
        error: "No valid question found in the CSV file",
      };
    }

    // Get the next order number
    const lastQuestion = await prisma.questionBankQuestion.findFirst({
      where: { questionBankId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    let nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

    // Insert all questions
    const createdQuestions = await prisma.$transaction(
      questions.map((q) =>
        prisma.questionBankQuestion.create({
          data: {
            questionBankId,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            order: nextOrder++,
          },
        })
      )
    );

    return {
      success: true,
      data: {
        count: createdQuestions.length,
        questions: createdQuestions,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload questions from CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error importing questions: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Upload quiz questions from CSV and assign them to modules based on chapter number
 * CSV format: id,chapter,question,option_a,option_b,option_c,option_d,correct_option,explanation
 * Chapter format: "Chapitre X" or just a number (e.g., "1", "2") where X is the module order number
 * @param assignToPhase1 - If true, creates Phase 1 quizzes (ContentItem/Quiz). If false, creates Phase 3 question banks.
 */
export async function uploadQuizCSVToModulesAction(
  courseId: string,
  csvContent: string,
  assignToPhase1: boolean = false
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    // Parse CSV content
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return {
        success: false,
        error: "The CSV file is empty",
      };
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const expectedHeaders = ["id", "chapter", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"];

    // Validate header format (case-insensitive)
    const headerLower = header.map(h => h.toLowerCase().trim());
    const hasValidFormat = expectedHeaders.every((expected, index) =>
      headerLower[index] === expected.toLowerCase()
    );

    if (!hasValidFormat) {
      return {
        success: false,
        error: `Invalid CSV format. Expected headers: ${expectedHeaders.join(", ")}`,
      };
    }

    // Parse questions and group by chapter
    const questionsByChapter = new Map<number, Array<{
      id: string;
      question: string;
      options: Record<string, string>;
      correctAnswer: string;
      explanation?: string;
    }>>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const fields = parseCSVLine(line);
      if (fields.length < 8) continue; // Skip incomplete rows

      // Extract fields - don't trim explanation yet as it may contain intentional whitespace
      const id = fields[0]?.trim() || "";
      const chapter = fields[1]?.trim() || "";
      const question = fields[2]?.trim() || "";
      const optionA = fields[3]?.trim() || "";
      const optionB = fields[4]?.trim() || "";
      const optionC = fields[5]?.trim() || "";
      const optionD = fields[6]?.trim() || "";
      const correctOption = fields[7]?.trim() || "";
      // Explanation may contain newlines and should preserve them, but trim leading/trailing whitespace
      const explanation = fields[8]?.trim() || "";

      // Extract chapter number - accept both "Chapitre X" format and just numbers
      let chapterNumber: number;
      const chapterMatch = chapter.match(/chapitre\s*(\d+)/i);
      if (chapterMatch) {
        // Format: "Chapitre X"
        chapterNumber = parseInt(chapterMatch[1], 10);
      } else {
        // Format: just a number
        const numMatch = chapter.match(/^\s*(\d+)\s*$/);
        if (numMatch) {
          chapterNumber = parseInt(numMatch[1], 10);
        } else {
          console.warn(`Unable to extract chapter number from: "${chapter}" on line ${i + 1}`);
          continue;
        }
      }

      if (isNaN(chapterNumber) || chapterNumber < 1) {
        console.warn(`Invalid chapter number: ${chapterNumber} on line ${i + 1}`);
        continue;
      }

      // Validate question and options
      if (!question || !optionA || !optionB) {
        console.warn(`Incomplete question on line ${i + 1}`);
        continue;
      }

      // Build options object
      const options: Record<string, string> = {
        A: optionA,
        B: optionB,
      };
      if (optionC) options.C = optionC;
      if (optionD) options.D = optionD;

      // Validate correct answer
      const correctAnswer = correctOption?.toUpperCase().trim();
      if (!correctAnswer || !options[correctAnswer]) {
        console.warn(`Invalid correct answer on line ${i + 1}: ${correctOption}`);
        continue;
      }

      // Add question to chapter group
      if (!questionsByChapter.has(chapterNumber)) {
        questionsByChapter.set(chapterNumber, []);
      }

      questionsByChapter.get(chapterNumber)!.push({
        id: id || `Q${i}`,
        question,
        options,
        correctAnswer,
        explanation: explanation ? explanation : undefined,
      });
    }

    if (questionsByChapter.size === 0) {
      return {
        success: false,
        error: "No valid question found in the CSV file",
      };
    }

    // Get all modules for this course
    const modules = await prisma.module.findMany({
      where: { courseId },
      select: {
        id: true,
        order: true,
        title: true,
      },
      orderBy: { order: "asc" },
    });

    if (modules.length === 0) {
      return {
        success: false,
        error: "No modules found for this course",
      };
    }

    // Create maps for different matching strategies
    const moduleMapByOrder = new Map<number, typeof modules[0]>();
    const moduleMapByTitle = new Map<number, typeof modules[0]>();

    modules.forEach(module => {
      moduleMapByOrder.set(module.order, module);

      // Try to extract chapter number from module title
      // Look for patterns like "Chapitre X", "Ch. X", "Chapter X", or just numbers
      const titleMatch = module.title.match(/(?:chapitre|ch\.?|chapter)\s*(\d+)/i) ||
        module.title.match(/\b(\d+)\b/);
      if (titleMatch) {
        const chapterNum = parseInt(titleMatch[1], 10);
        if (!isNaN(chapterNum)) {
          moduleMapByTitle.set(chapterNum, module);
        }
      }
    });

    // Import createContentItemAction for Phase 1
    const { createContentItemAction } = await import("@/app/actions/content-items");

    // Process each chapter
    const results: Array<{
      chapterNumber: number;
      moduleTitle?: string;
      questionBankId?: string;
      quizId?: string;
      questionCount: number;
    }> = [];

    for (const [chapterNumber, questions] of questionsByChapter.entries()) {
      // Try multiple matching strategies:
      // 1. Match by title (most reliable if titles contain "Chapitre X")
      // 2. Match by order (chapterNumber)
      // 3. Match by order (chapterNumber - 1) for 0-indexed
      let moduleRecord = moduleMapByTitle.get(chapterNumber);

      if (!moduleRecord) {
        // Try matching by order
        moduleRecord = moduleMapByOrder.get(chapterNumber);
      }

      if (!moduleRecord) {
        // Try 0-indexed matching
        moduleRecord = moduleMapByOrder.get(chapterNumber - 1);
      }

      if (!moduleRecord) {
        console.warn(
          `Module for Chapter ${chapterNumber} not found. ` +
          `Modules disponibles: ${modules.map(m => `${m.title} (order: ${m.order})`).join(", ")}`
        );
        continue;
      }

      if (assignToPhase1) {
        // Phase 1: Create ContentItem + Quiz + QuizQuestion
        // Check if quiz already exists for this module
        const existingQuiz = await prisma.quiz.findFirst({
          where: {
            contentItem: {
              moduleId: moduleRecord.id,
              contentType: "QUIZ",
              studyPhase: "PHASE_1_LEARN",
            },
          },
          include: {
            contentItem: true,
          },
        });

        let quiz;
        let contentItem;

        if (existingQuiz) {
          quiz = existingQuiz;
          contentItem = existingQuiz.contentItem;
        } else {
          // Create ContentItem for Phase 1 quiz
          const contentItemResult = await createContentItemAction({
            moduleId: moduleRecord.id,
            contentType: "QUIZ",
            studyPhase: "PHASE_1_LEARN",
            order: 0, // Will be auto-adjusted
          });

          if (!contentItemResult.success || !contentItemResult.data) {
            console.warn(`Error creating ContentItem for Chapter ${chapterNumber}`);
            continue;
          }

          contentItem = contentItemResult.data;

          // Create Quiz
          quiz = await prisma.quiz.create({
            data: {
              contentItemId: contentItem.id,
              courseId, // Direct course link for efficient queries
              title: `Chapter ${chapterNumber} Quiz`,
              passingScore: 70,
              timeLimit: 3600, // 60 minutes default
              isMockExam: false,
            },
          });
        }

        // Get the next order number for quiz questions
        const lastQuestion = await prisma.quizQuestion.findFirst({
          where: { quizId: quiz.id },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        let nextOrder = lastQuestion ? lastQuestion.order + 1 : 1;

        // Convert options format from {A: "...", B: "..."} to {option1: "...", option2: "..."}
        const convertOptions = (options: Record<string, string>) => {
          const converted: Record<string, string> = {};
          const letters = ["A", "B", "C", "D"];
          letters.forEach((letter, index) => {
            if (options[letter]) {
              converted[`option${index + 1}`] = options[letter];
            }
          });
          return converted;
        };

        // Create questions for quiz
        const createdQuestions = await prisma.$transaction(
          questions.map((q) => {
            const convertedOptions = convertOptions(q.options);
            return prisma.quizQuestion.create({
              data: {
                quizId: quiz.id,
                order: nextOrder++,
                type: "MULTIPLE_CHOICE",
                question: q.question,
                options: convertedOptions,
                correctAnswer: q.options[q.correctAnswer] || q.correctAnswer, // Phase 1 uses full text match often
                explanation: q.explanation || null,
              },
            });
          })
        );

        results.push({
          chapterNumber,
          moduleTitle: moduleRecord.title,
          quizId: quiz.id,
          questionCount: createdQuestions.length,
        });

      } else {
        // Phase 3: Create QuestionBank + QuestionBankQuestion
        // Check if question bank already exists for this module
        const existingBank = await prisma.questionBank.findFirst({
          where: { courseId, moduleId: moduleRecord.id },
        });

        let questionBankId: string;

        if (existingBank) {
          questionBankId = existingBank.id;
        } else {
          // Create new question bank
          const newBank = await prisma.questionBank.create({
            data: {
              courseId,
              moduleId: moduleRecord.id,
              title: `Banque ${moduleRecord.order}: ${moduleRecord.title}`,
              description: `Questions for Chapter ${moduleRecord.order}`,
            },
          });
          questionBankId = newBank.id;
        }

        // Get the next order number
        const lastQuestion = await prisma.questionBankQuestion.findFirst({
          where: { questionBankId },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        let nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

        // Create questions
        const createdQuestions = await prisma.$transaction(
          questions.map((q) =>
            prisma.questionBankQuestion.create({
              data: {
                questionBankId,
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || null,
                order: nextOrder++,
              },
            })
          )
        );

        results.push({
          chapterNumber,
          moduleTitle: moduleRecord.title,
          questionBankId,
          questionCount: createdQuestions.length,
        });
      }
    }

    return {
      success: true,
      data: {
        totalQuestions: results.reduce((sum, r) => sum + r.questionCount, 0),
        chaptersProcessed: results.length,
        details: results,
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
      error: `Error importing questions: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Add selected questions to a Phase 1 quiz
 */
export async function addSelectedQuestionsToPhase1QuizAction(
  questionIds: string[],
  quizId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const questions = await prisma.questionBankQuestion.findMany({
      where: {
        id: { in: questionIds },
      },
    });

    if (questions.length === 0) {
      return {
        success: false,
        error: "No questions found",
      };
    }

    // Get the quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return {
        success: false,
        error: "Quiz not found",
      };
    }

    // Get the next order number for quiz questions
    const lastQuestion = await prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    let nextOrder = lastQuestion ? lastQuestion.order + 1 : 1;

    // Convert options format from {A: "...", B: "..."} to {option1: "...", option2: "..."}
    const convertOptions = (options: any) => {
      const converted: Record<string, string> = {};
      const letters = ["A", "B", "C", "D"];

      if (typeof options === 'object' && options !== null) {
        letters.forEach((letter, index) => {
          if (options[letter]) {
            converted[`option${index + 1}`] = options[letter];
          }
        });
      }
      return converted;
    };

    // Create quiz questions
    const createdQuestions = await prisma.$transaction(
      questions.map((q) => {
        const options = q.options as Record<string, string>;
        const convertedOptions = convertOptions(options);

        // Find the full text of the correct answer
        const correctAnswerText = options[q.correctAnswer] || q.correctAnswer;

        return prisma.quizQuestion.create({
          data: {
            quizId,
            order: nextOrder++,
            type: "MULTIPLE_CHOICE",
            question: q.question,
            options: convertedOptions,
            correctAnswer: correctAnswerText,
            explanation: q.explanation || null,
          },
        });
      })
    );

    return {
      success: true,
      data: {
        count: createdQuestions.length,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to add questions to Phase 1 quiz: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error adding questions to quiz",
    };
  }
}

/**
 * Add an entire question bank to a Phase 1 quiz
 */
export async function addQuestionBankToPhase1QuizAction(
  bankId: string,
  quizId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const questions = await prisma.questionBankQuestion.findMany({
      where: {
        questionBankId: bankId,
      },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    if (questions.length === 0) {
      return {
        success: false,
        error: "No questions in this bank",
      };
    }

    const questionIds = questions.map((q) => q.id);
    return addSelectedQuestionsToPhase1QuizAction(questionIds, quizId);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to add bank to Phase 1 quiz: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error adding question bank to quiz",
    };
  }
}

/**
 * Get Phase 1 quizzes for assignment
 */
export async function getPhase1QuizzesAction(
  courseId: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    const quizzes = await prisma.quiz.findMany({
      where: {
        courseId,
        contentItem: {
          studyPhase: "PHASE_1_LEARN",
        },
      },
      include: {
        contentItem: {
          select: {
            moduleId: true,
            module: {
              select: {
                title: true,
                order: true,
              },
            },
          },
        },
      },
      orderBy: {
        contentItem: {
          module: {
            order: "asc",
          },
        },
      },
    });

    const result = quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      moduleId: quiz.contentItem?.moduleId,
      moduleTitle: quiz.contentItem?.module?.title,
      moduleOrder: quiz.contentItem?.module?.order,
    }));

    return { success: true, data: result };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get Phase 1 quizzes: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error loading Phase 1 quizzes",
      data: [],
    };
  }
}

/**
 * Helper function to parse CSV line (handles quoted fields with commas)
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Add last field
  fields.push(currentField);

  return fields;
}

/**
 * Upload questions from JSON file and assign them to modules
 */
export async function uploadQuestionBankJsonAction(
  courseId: string,
  jsonContent: string
): Promise<QuestionBankResult> {
  try {
    await requireAdmin();

    // Parse JSON
    let parsedData;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (e) {
      return { success: false, error: "Invalid JSON format" };
    }

    const rawQuestions = parsedData.questions;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return { success: false, error: "No 'questions' array found in JSON" };
    }

    // Group by 'element' (which maps to module)
    const questionsByModule = new Map<number, any[]>();

    for (const q of rawQuestions) {
      const elementStr = String(q.element || "");
      // Try to parse 'element' as integer order
      const elementNum = parseInt(elementStr, 10);

      if (!isNaN(elementNum) && elementNum > 0) {
        // Convert 1-based element number to 0-based module order
        const moduleOrder = elementNum - 1;

        if (!questionsByModule.has(moduleOrder)) {
          questionsByModule.set(moduleOrder, []);
        }
        questionsByModule.get(moduleOrder)!.push(q);
      } else {
        // Fallback or skip? Warn console
        console.warn("Question skipped due to invalid element:", q.question_id);
      }
    }

    if (questionsByModule.size === 0) {
      return { success: false, error: "No valid questions with 'element' fields found" };
    }

    // Get modules
    const modules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true, order: true, title: true },
    });

    // Map order -> Module
    const modulesByOrder = new Map<number, typeof modules[0]>();
    modules.forEach(m => modulesByOrder.set(m.order, m));

    let createdCount = 0;
    const details = [];

    // Process groups
    for (const [order, questions] of questionsByModule.entries()) {
      const moduleRecord = modulesByOrder.get(order);
      if (!moduleRecord) {
        console.warn(`Module with order ${order} not found`);
        continue;
      }

      // Find or create Question Bank for this module
      let questionBankId: string;
      const existingBank = await prisma.questionBank.findFirst({
        where: { courseId, moduleId: moduleRecord.id },
      });

      if (existingBank) {
        questionBankId = existingBank.id;
      } else {
        const newBank = await prisma.questionBank.create({
          data: {
            courseId,
            moduleId: moduleRecord.id,
            // Use order + 1 for user-facing display (e.g. Chapter 1 instead of Chapter 0)
            title: `Chapter ${moduleRecord.order + 1} Question Bank`,
            description: `Imported from JSON for Module ${moduleRecord.order + 1}`,
          },
        });
        questionBankId = newBank.id;
      }

      // Get max order
      const lastQ = await prisma.questionBankQuestion.findFirst({
        where: { questionBankId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      let nextOrder = lastQ ? lastQ.order + 1 : 0;

      // Insert questions
      const created = await prisma.$transaction(
        questions.map((q) => {
          // options is object in JSON { "A": "...", ... }
          // correctAnswer is "B"
          // explanation "B is correct..."

          return prisma.questionBankQuestion.create({
            data: {
              questionBankId,
              question: q.question,
              options: q.options || {},
              correctAnswer: q.correct_answer || "",
              explanation: q.explanation || null,
              order: nextOrder++,
            },
          });
        })
      );

      createdCount += created.length;
      details.push({ module: moduleRecord.title, count: created.length });
    }

    return {
      success: true,
      data: {
        count: createdCount,
        details,
      },
    };

  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload JSON questions: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Error importing from JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
