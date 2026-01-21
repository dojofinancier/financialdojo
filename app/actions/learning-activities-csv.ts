"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";
import { revalidatePath } from "next/cache";
import { createContentItemAction } from "@/app/actions/content-items";
import { createLearningActivityAction } from "@/app/actions/learning-activities";

export type LearningActivityCSVUploadResult = {
  success: boolean;
  error?: string;
  data?: {
    activitiesCreated?: number;
    errors?: string[];
  };
};

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
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
}

/**
 * Upload learning activities from CSV
 */
export async function uploadLearningActivitiesCSVAction(
  courseId: string,
  csvContent: string
): Promise<LearningActivityCSVUploadResult> {
  try {
    await requireAdmin();

    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      return { success: false, error: "The CSV file must contain at least one header and one row of data" };
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const headerMap: Record<string, number> = {};
    header.forEach((h, i) => {
      headerMap[h.trim()] = i;
    });

    // Get modules for mapping
    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
    });

    // Create a map for quick lookups
    const moduleMap: Record<string, string> = {};
    const moduleByOrder: Record<number, string> = {}; // Direct order -> id mapping
    const moduleByChapterNumber: Record<number, string> = {}; // Chapter number from title -> id mapping
    
    modules.forEach((m) => {
      // Map by module order number (e.g., "Module 13" -> module with order = 13)
      moduleMap[`Module ${m.order}`] = m.id;
      // Direct order number mapping
      moduleByOrder[m.order] = m.id;
      
      // Extract chapter number from title (e.g., "Chapitre 13" -> 13)
      const chapterMatch = m.title.match(/Chapitre\s+(\d+)/i);
      if (chapterMatch) {
        const chapterNum = parseInt(chapterMatch[1], 10);
        if (!isNaN(chapterNum)) {
          moduleByChapterNumber[chapterNum] = m.id;
          moduleMap[`Module ${chapterNum}`] = m.id; // Also map "Module 13" to chapter 13
        }
      }
      
      // Extract chapter number from shortTitle if it exists (e.g., "13 - ..." -> 13)
      if (m.shortTitle) {
        const shortTitleMatch = m.shortTitle.match(/^(\d+)\s*-/);
        if (shortTitleMatch) {
          const chapterNum = parseInt(shortTitleMatch[1], 10);
          if (!isNaN(chapterNum)) {
            moduleByChapterNumber[chapterNum] = m.id;
            moduleMap[`Module ${chapterNum}`] = m.id;
          }
        }
        moduleMap[m.shortTitle] = m.id;
      }
      
      // Also map by full title for flexibility
      moduleMap[m.title] = m.id;
    });

    let activitiesCreated = 0;
    const errors: string[] = [];

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const fields = parseCSVLine(line);
        const activityType = fields[headerMap["ActivityType"]]?.toUpperCase();

        if (!activityType) {
          errors.push(`Ligne ${i + 1}: ActivityType manquant`);
          continue;
        }

        // Get module ID
        const moduleName = (fields[headerMap["Module"]] || "").trim();
        
        // Try multiple matching strategies
        let moduleId: string | null = null;
        
        // Strategy 1: If it's just a number, match by chapter number from title (not order field)
        const directNumber = parseInt(moduleName, 10);
        if (!isNaN(directNumber)) {
          // First try chapter number (extracted from title)
          if (moduleByChapterNumber[directNumber]) {
            moduleId = moduleByChapterNumber[directNumber];
          }
          // Fallback to order number if chapter number not found
          else if (moduleByOrder[directNumber]) {
            moduleId = moduleByOrder[directNumber];
          }
        }
        
        // Strategy 2: Extract number from "Module X" format and match by chapter number
        if (!moduleId) {
          const moduleNumberMatch = moduleName.match(/Module\s+(\d+)/i);
          if (moduleNumberMatch) {
            const moduleNumber = parseInt(moduleNumberMatch[1], 10);
            if (!isNaN(moduleNumber)) {
              // First try chapter number (extracted from title)
              if (moduleByChapterNumber[moduleNumber]) {
                moduleId = moduleByChapterNumber[moduleNumber];
              }
              // Fallback to order number if chapter number not found
              else if (moduleByOrder[moduleNumber]) {
                moduleId = moduleByOrder[moduleNumber];
              }
            }
          }
        }
        
        // Strategy 3: Direct lookup in moduleMap (exact match for "Module X" format)
        if (!moduleId && moduleMap[moduleName]) {
          moduleId = moduleMap[moduleName];
        }
        
        // Strategy 4: Try case-insensitive title match
        if (!moduleId) {
          const moduleByTitle = modules.find(m => 
            m.title.toLowerCase() === moduleName.toLowerCase() ||
            (m.shortTitle && m.shortTitle.toLowerCase() === moduleName.toLowerCase())
          );
          if (moduleByTitle) {
            moduleId = moduleByTitle.id;
          }
        }

        // Fallback to first module if still not found
        if (!moduleId) {
          moduleId = modules[0]?.id || null;
          if (moduleId) {
            errors.push(`Ligne ${i + 1}: Module "${moduleName}" introuvable, assigné au premier module par défaut`);
          } else {
            errors.push(`Ligne ${i + 1}: Module "${moduleName}" introuvable et aucun module disponible`);
            continue;
          }
        }

        // Get instructions
        const instructions = fields[headerMap["Instructions"]] || null;

        // Create content item first
        const contentItemResult = await createContentItemAction({
          moduleId,
          contentType: "LEARNING_ACTIVITY",
          order: 0,
          studyPhase: "PHASE_2_REVIEW",
        });

        if (!contentItemResult.success || !contentItemResult.data) {
          errors.push(`Ligne ${i + 1}: Erreur lors de la création de l'élément de contenu`);
          continue;
        }

        const contentItemId = contentItemResult.data.id;

        // Process each activity type
        let content: any = {};
        let correctAnswers: any = null;
        let tolerance: number | null = null;

        switch (activityType) {
          case "SHORT_ANSWER": {
            const question = fields[headerMap["Question"]] || "";
            const answer1 = fields[headerMap["CorrectAnswer1"]] || "";
            const answer2 = fields[headerMap["CorrectAnswer2"]] || "";
            const answer3 = fields[headerMap["CorrectAnswer3"]] || "";

            if (!question || !answer1) {
              errors.push(`Ligne ${i + 1}: Question ou réponse manquante`);
              continue;
            }

            content = { question };
            correctAnswers = [answer1, answer2, answer3].filter((a) => a.trim());
            break;
          }

          case "FILL_IN_BLANK": {
            const text = fields[headerMap["Text"]] || "";
            const correctAnswer = fields[headerMap["CorrectAnswer"]] || "";

            if (!text || !correctAnswer) {
              errors.push(`Ligne ${i + 1}: Texte ou réponse manquante`);
              continue;
            }

            content = { text };
            correctAnswers = [correctAnswer];
            break;
          }

          case "SORTING_RANKING": {
            const items: string[] = [];
            let itemIndex = 1;
            while (headerMap[`Item${itemIndex}`] !== undefined) {
              const item = fields[headerMap[`Item${itemIndex}`]];
              if (item && item.trim()) {
                items.push(item.trim());
              }
              itemIndex++;
            }

            if (items.length < 2) {
              errors.push(`Ligne ${i + 1}: Au moins 2 éléments requis pour le tri`);
              continue;
            }

            content = { items, instructions: instructions || "" };
            correctAnswers = items; // Correct order is the order provided
            break;
          }

          case "CLASSIFICATION": {
            const categories: string[] = [];
            let catIndex = 1;
            while (headerMap[`Category${catIndex}`] !== undefined) {
              const cat = fields[headerMap[`Category${catIndex}`]];
              if (cat && cat.trim()) {
                categories.push(cat.trim());
              }
              catIndex++;
            }

            const items: Record<string, string> = {};
            // Look for columns that match Item*|Category pattern
            Object.keys(headerMap).forEach((headerKey) => {
              if (headerKey.includes("|")) {
                const itemField = fields[headerMap[headerKey]];
                if (itemField && itemField.trim()) {
                  // Handle both "item|category" format and quoted format
                  const cleanField = itemField.replace(/^"|"$/g, "");
                  if (cleanField.includes("|")) {
                    const [item, category] = cleanField.split("|").map((s) => s.trim());
                    if (item && category) {
                      items[item] = category;
                    }
                  }
                }
              }
            });

            if (categories.length < 2 || Object.keys(items).length === 0) {
              errors.push(`Ligne ${i + 1}: Au moins 2 catégories et des éléments requis`);
              continue;
            }

            content = { categories, items, instructions: instructions || "" };
            correctAnswers = items; // Correct classification
            break;
          }

          case "NUMERIC_ENTRY": {
            const question = fields[headerMap["Question"]] || "";
            const correctAnswerStr = fields[headerMap["CorrectAnswer"]] || "";
            const toleranceStr = fields[headerMap["Tolerance"]] || "";

            if (!question || !correctAnswerStr) {
              errors.push(`Ligne ${i + 1}: Question ou réponse manquante`);
              continue;
            }

            const correctAnswerNum = parseFloat(correctAnswerStr);
            if (isNaN(correctAnswerNum)) {
              errors.push(`Ligne ${i + 1}: Réponse numérique invalide`);
              continue;
            }

            content = { question };
            correctAnswers = correctAnswerNum;
            tolerance = toleranceStr ? parseFloat(toleranceStr) : null;
            break;
          }

          case "TABLE_COMPLETION": {
            const tableJSON = fields[headerMap["TableJSON"]] || "";
            const answersJSON = fields[headerMap["AnswersJSON"]] || "";

            if (!tableJSON || !answersJSON) {
              errors.push(`Ligne ${i + 1}: TableJSON ou AnswersJSON manquant`);
              continue;
            }

            try {
              const table = JSON.parse(tableJSON);
              const answers = JSON.parse(answersJSON);
              content = { table, instructions: instructions || "" };
              correctAnswers = answers;
            } catch (e) {
              errors.push(`Ligne ${i + 1}: JSON invalide: ${e instanceof Error ? e.message : "Erreur"}`);
              continue;
            }
            break;
          }

          case "ERROR_SPOTTING": {
            const incorrectSolution = fields[headerMap["IncorrectSolution"]] || "";
            const question = fields[headerMap["Question"]] || "";
            const correctAnswer = fields[headerMap["CorrectAnswer"]] || "";

            if (!incorrectSolution || !question || !correctAnswer) {
              errors.push(`Ligne ${i + 1}: Champs manquants`);
              continue;
            }

            content = { incorrectSolution, question };
            correctAnswers = correctAnswer;
            break;
          }

          case "DEEP_DIVE": {
            const topic = fields[headerMap["Topic"]] || "";
            const question1 = fields[headerMap["Question1"]] || "";
            const question2 = fields[headerMap["Question2"]] || "";
            const question3 = fields[headerMap["Question3"]] || "";

            if (!topic) {
              errors.push(`Ligne ${i + 1}: Topic manquant`);
              continue;
            }

            const questions = [question1, question2, question3].filter((q) => q.trim());
            if (questions.length === 0) {
              errors.push(`Ligne ${i + 1}: Au moins une question requise`);
              continue;
            }

            content = { topic, questions };
            // No correctAnswers for DEEP_DIVE (not auto-graded)
            break;
          }

          default:
            errors.push(`Ligne ${i + 1}: Type d'activité inconnu: ${activityType}`);
            continue;
        }

        // Create learning activity - pass courseId directly to avoid lookup issues
        const result = await createLearningActivityAction({
          moduleId,
          courseId, // Pass courseId directly from the upload context
          activityType: activityType as any,
          title: undefined, // Will be auto-generated
          instructions,
          content,
          correctAnswers,
          tolerance,
          contentItemId,
        });

        if (result.success) {
          activitiesCreated++;
        } else {
          errors.push(`Ligne ${i + 1}: ${result.error || "Error creating"}`);
        }
      } catch (error) {
        errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    revalidatePath(`/dashboard/admin/courses/${courseId}`);
    return {
      success: true,
      data: {
        activitiesCreated,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload learning activities CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "HIGH",
    });

    return {
      success: false,
      error: `Erreur lors de l'upload: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

