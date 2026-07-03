/**
 * Shared helpers for displaying stored quiz/exam answers (MCQ option keys, letters, etc.)
 */

export function getOptionLetter(key: string, index: number): string {
  if (/^[A-Z]$/i.test(key)) {
    return key.toUpperCase();
  }
  return String.fromCharCode(65 + index);
}

export function getOrderedOptionKeys(options: Record<string, string>) {
  const optionKeys = Object.keys(options || {});
  return optionKeys.slice().sort((a, b) => {
    const aNum = Number.parseInt(a.replace(/\D/g, ""), 10);
    const bNum = Number.parseInt(b.replace(/\D/g, ""), 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export function resolveAnswerIndex(
  answer: string | undefined,
  options: Record<string, string>
): number | null {
  if (!answer) return null;
  const trimmed = answer.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const orderedKeys = getOrderedOptionKeys(options);

  const directKey = orderedKeys.find((key) => key.toLowerCase() === lower);
  if (directKey) return orderedKeys.indexOf(directKey);

  const valueMatchKey = orderedKeys.find((key) => {
    const value = options[key];
    return value && value.trim().toLowerCase() === lower;
  });
  if (valueMatchKey) return orderedKeys.indexOf(valueMatchKey);

  const letterMatch = lower.match(/^([a-d])\s*[\).:\-]?/);
  if (letterMatch) {
    const idx = ["a", "b", "c", "d"].indexOf(letterMatch[1]);
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  const numberMatch = lower.match(/^([1-4])\s*[\).:\-]?/);
  if (numberMatch) {
    const idx = Number.parseInt(numberMatch[1], 10) - 1;
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  const optionMatch = lower.match(/^option\s*([1-9]\d*)/);
  if (optionMatch) {
    const idx = Number.parseInt(optionMatch[1], 10) - 1;
    if (idx >= 0 && idx < orderedKeys.length) return idx;
  }

  return null;
}

/** Map A/B/C/D correct-answer keys to option1/option2/... during bulk import. */
export function convertCorrectAnswerForImport(correctAnswer: string): string {
  const letters = ["A", "B", "C", "D"];
  const index = letters.indexOf(correctAnswer.toUpperCase());
  return index >= 0 ? `option${index + 1}` : correctAnswer;
}

export function isAnswerCorrect(
  question: {
    type: string;
    correctAnswer: string;
    options: unknown;
  },
  userAnswer: string | undefined
): boolean {
  const correctAnswer = question.correctAnswer;
  if (!userAnswer || !correctAnswer?.trim()) return false;

  if (question.type === "MULTIPLE_CHOICE") {
    const options = (question.options as Record<string, string>) || {};
    const userIndex = resolveAnswerIndex(userAnswer, options);
    const correctIndex = resolveAnswerIndex(correctAnswer, options);
    return userIndex !== null && correctIndex !== null && userIndex === correctIndex;
  }

  return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

export function getAnswerDisplay(answer: string | undefined, options: Record<string, string>) {
  if (!answer) {
    return { label: "Not answered", value: null as string | null };
  }
  const index = resolveAnswerIndex(answer, options);
  const orderedKeys = getOrderedOptionKeys(options);
  if (index === null || index < 0 || index >= orderedKeys.length) {
    return { label: answer, value: null as string | null };
  }
  const key = orderedKeys[index];
  const letter = getOptionLetter(key, index);
  return { label: `${letter}: ${options[key]}`, value: key };
}
