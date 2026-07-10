/** Frozen MCQ used for Phase 1 supplementary quizzes (from question bank). */
export type QuizQuestionSnapshotItem = {
  id: string;
  order: number;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string | null;
};

export type QuizQuestionSnapshotPublic = Omit<
  QuizQuestionSnapshotItem,
  "correctAnswer" | "explanation"
>;

export const SUPPLEMENTARY_QUIZ_QUESTION_COUNT = 10;
export const SUPPLEMENTARY_QUIZ_MIN_POOL = 10;

export function toPublicSnapshot(
  items: QuizQuestionSnapshotItem[]
): QuizQuestionSnapshotPublic[] {
  return items.map(({ id, order, question, options }) => ({
    id,
    order,
    question,
    options,
  }));
}
