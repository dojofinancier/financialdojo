/**
 * Course Content Inventory
 * Counts actual course content for adaptive study plan generation
 */

import { prisma } from "@/lib/prisma";

export interface ModuleInventory {
  id: string;
  title: string;
  order: number;
  videos: number;
  notes: number;
  quizzes: number;
  flashcards: number;
  learningActivities: number;
  estimatedBlocks: number; // (videos × 2) + (quizzes × 1) + (notes × 1)
  contentItemsDetailed: Array<{
    id: string;
    contentType: string;
    order: number;
  }>;
  quizzesDetailed: Array<{
    id: string;
    contentItemId: string;
  }>;
}

export interface CourseContentInventory {
  modules: ModuleInventory[];
  totalFlashcards: number;
  totalLearningActivities: number;
  totalQuestionBanks: number;
  mockExams: number;
  totalEstimatedBlocks: {
    learn: number;
    review: number; // Will be calculated based on spaced repetition
    practice: number; // Mock exams + question banks
  };
  minimumStudyTime: number; // (modules × 4) + (mockExams × 4)
}

/**
 * Get comprehensive content inventory for a course
 */
export async function getCourseContentInventory(
  courseId: string
): Promise<CourseContentInventory> {
  // Get all modules with their content
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      contentItems: {
        where: {
          contentType: {
            in: ["VIDEO", "NOTE", "QUIZ"],
          },
        },
        orderBy: { order: "asc" },
        include: {
          quiz: true,
        },
      },
    },
  });

  console.log(
    `[CourseContentInventory] Course ${courseId}: fetched ${modules.length} modules`
  );

  const moduleIds = modules.map((module) => module.id);

  // Get flashcards for the course
  const flashcards = await prisma.flashcard.findMany({
    where: { courseId },
    select: { id: true, moduleId: true },
  });

  // Get learning activities for the course
  const learningActivities = await prisma.learningActivity.findMany({
    where: moduleIds.length
      ? {
        moduleId: {
          in: moduleIds,
        },
      }
      : undefined,
    select: { id: true, moduleId: true },
  });

  // Get question banks for the course
  const questionBanks = await prisma.questionBank.findMany({
    where: { courseId },
  });

  // Get mock exams (quizzes with isMockExam = true)
  const mockExams = await prisma.quiz.findMany({
    where: {
      courseId,
      isMockExam: true,
    },
  });

  // Build module inventory
  const moduleInventory: ModuleInventory[] = modules.map((module) => {
    const videoItems = module.contentItems.filter(
      (item) => item.contentType === "VIDEO"
    );
    const noteItems = module.contentItems.filter(
      (item) => item.contentType === "NOTE"
    );
    const quizItems = module.contentItems.filter(
      (item) =>
        item.contentType === "QUIZ" &&
        item.quiz &&
        item.quiz.isMockExam === false
    );

    const videos = videoItems.length;
    const notes = noteItems.length;
    const quizzes = quizItems.length;

    // Count flashcards for this module
    const moduleFlashcards = flashcards.filter(
      (f) => f.moduleId === module.id
    ).length;

    // Count learning activities for this module
    const moduleActivities = learningActivities.filter(
      (a) => a.moduleId === module.id
    ).length;

    // Calculate blocks: (videos × 2) + (quizzes × 1) + (notes × 1)
    const estimatedBlocks = videos * 2 + quizzes * 1 + notes * 1;

    return {
      id: module.id,
      title: module.title,
      order: module.order,
      videos,
      notes,
      quizzes,
      flashcards: moduleFlashcards,
      learningActivities: moduleActivities,
      estimatedBlocks,
      contentItemsDetailed: videoItems
        .concat(noteItems)
        .map((item) => ({
          id: item.id,
          contentType: item.contentType,
          order: item.order,
        })),
      quizzesDetailed: quizItems.map((item) => ({
        id: item.quiz!.id,
        contentItemId: item.id,
      })),
    };
  });

  // Calculate totals
  const totalFlashcards = flashcards.length;
  const totalLearningActivities = learningActivities.length;
  const totalQuestionBanks = questionBanks.length;
  const mockExamCount = mockExams.length;

  // Calculate total blocks
  const totalLearnBlocks = moduleInventory.reduce(
    (sum, module) => sum + module.estimatedBlocks,
    0
  );

  // Review blocks will be calculated based on spaced repetition schedule
  // This is an estimate - actual review blocks depend on when modules are learned
  const totalReviewBlocks = 0; // Will be calculated during plan generation

  // Practice blocks: mock exams (4 blocks each) + question banks (estimated)
  const mockExamBlocks = mockExamCount * 4;
  const questionBankBlocks = totalQuestionBanks * 1.5; // Estimate
  const totalPracticeBlocks = mockExamBlocks + questionBankBlocks;

  // Calculate minimum study time: (modules × 4) + (mockExams × 4)
  const minimumStudyTime = moduleInventory.length * 4 + mockExamCount * 4;

  return {
    modules: moduleInventory,
    totalFlashcards,
    totalLearningActivities,
    totalQuestionBanks,
    mockExams: mockExamCount,
    totalEstimatedBlocks: {
      learn: totalLearnBlocks,
      review: totalReviewBlocks,
      practice: totalPracticeBlocks,
    },
    minimumStudyTime,
  };
}

