/**
 * Phase 3 Gate Check
 * Verifies that all modules are marked as learned before allowing Phase 3 access
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface Phase3GateResult {
  canAccess: boolean;
  learnedModules: number;
  totalModules: number;
  unlearnedModules: Array<{ id: string; title: string; order: number }>;
  message?: string;
}

/**
 * Check if user can access Phase 3 (all modules must be learned)
 */
export async function checkPhase3Access(
  userId: string,
  courseId: string
): Promise<Phase3GateResult> {
  // Get all modules for the course
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
    },
  });

  // Get module progress
  const moduleProgress = await prisma.moduleProgress.findMany({
    where: {
      userId,
      courseId,
    },
    select: {
      moduleId: true,
      learnStatus: true,
    },
  });

  const learnedModuleIds = new Set(
    moduleProgress
      .filter((p) => p.learnStatus === "LEARNED")
      .map((p) => p.moduleId)
  );

  const unlearnedModules = modules.filter((m) => !learnedModuleIds.has(m.id));

  const canAccess = unlearnedModules.length === 0;

  let message: string | undefined;
  if (!canAccess) {
    const moduleList = unlearnedModules
      .map((m) => `Module ${m.order}: ${m.title}`)
      .join(", ");
    message = `You must mark all modules as completed to access Phase 3. Remaining modules: ${moduleList}`;
  }

  return {
    canAccess,
    learnedModules: learnedModuleIds.size,
    totalModules: modules.length,
    unlearnedModules,
    message,
  };
}

