import { prisma } from "@/lib/prisma";

export type CourseAggregate = {
  courseId: string;
  courseTitle: string;
  enrollmentCount: number;
  totalContentItems: number;
  completedItems: number;
  totalProgressEntries: number;
  totalTimeSpent: number;
  averageCompletionRate: number;
};

/**
 * Compute per-course completion/engagement aggregates with a fixed number of
 * grouped queries (no per-course N+1 counts, no loading the full course tree
 * into memory). Shared by the completion-rate, course-metric, and consolidated
 * overview data loaders so the work runs only once per request.
 */
export async function computeCourseAggregates(): Promise<CourseAggregate[]> {
  const [
    courses,
    enrollmentGroups,
    modules,
    contentItems,
    progressTotals,
    progressCompleted,
    timeTotals,
  ] = await Promise.all([
    prisma.course.findMany({ select: { id: true, title: true } }),
    prisma.enrollment.groupBy({ by: ["courseId"], _count: { _all: true } }),
    prisma.module.findMany({ select: { id: true, courseId: true } }),
    prisma.contentItem.findMany({ select: { id: true, moduleId: true } }),
    prisma.progressTracking.groupBy({ by: ["contentItemId"], _count: { _all: true } }),
    prisma.progressTracking.groupBy({
      by: ["contentItemId"],
      where: { completedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.progressTracking.groupBy({ by: ["contentItemId"], _sum: { timeSpent: true } }),
  ]);

  const moduleToCourse = new Map<string, string>();
  for (const m of modules) moduleToCourse.set(m.id, m.courseId);

  const contentToCourse = new Map<string, string>();
  const contentCountByCourse = new Map<string, number>();
  for (const ci of contentItems) {
    const courseId = moduleToCourse.get(ci.moduleId);
    if (!courseId) continue;
    contentToCourse.set(ci.id, courseId);
    contentCountByCourse.set(courseId, (contentCountByCourse.get(courseId) || 0) + 1);
  }

  const enrollByCourse = new Map<string, number>();
  for (const g of enrollmentGroups) enrollByCourse.set(g.courseId, g._count._all);

  const accumulateByCourse = (
    rows: Array<{ contentItemId: string }>,
    valueOf: (row: any) => number
  ) => {
    const out = new Map<string, number>();
    for (const row of rows) {
      const courseId = contentToCourse.get(row.contentItemId);
      if (!courseId) continue;
      out.set(courseId, (out.get(courseId) || 0) + valueOf(row));
    }
    return out;
  };

  const completedByCourse = accumulateByCourse(progressCompleted, (r) => r._count._all);
  const totalProgressByCourse = accumulateByCourse(progressTotals, (r) => r._count._all);
  const timeByCourse = accumulateByCourse(timeTotals, (r) => r._sum.timeSpent || 0);

  return courses.map((c) => {
    const enrollmentCount = enrollByCourse.get(c.id) || 0;
    const totalContentItems = contentCountByCourse.get(c.id) || 0;
    const completedItems = completedByCourse.get(c.id) || 0;
    const totalProgressEntries = totalProgressByCourse.get(c.id) || 0;
    const totalTimeSpent = timeByCourse.get(c.id) || 0;
    const averageCompletionRate =
      enrollmentCount > 0 && totalContentItems > 0
        ? Math.min(100, (completedItems / (enrollmentCount * totalContentItems)) * 100)
        : 0;
    return {
      courseId: c.id,
      courseTitle: c.title,
      enrollmentCount,
      totalContentItems,
      completedItems,
      totalProgressEntries,
      totalTimeSpent,
      averageCompletionRate,
    };
  });
}

/** Shape aggregates into the completion-rates payload. */
export function toCompletionRates(aggregates: CourseAggregate[]) {
  return aggregates.map((c) => ({
    courseId: c.courseId,
    courseTitle: c.courseTitle,
    totalEnrollments: c.enrollmentCount,
    totalContentItems: c.totalContentItems,
    completedItems: c.completedItems,
    totalProgressEntries: c.totalProgressEntries,
    averageCompletionRate: c.averageCompletionRate,
  }));
}

/** Shape aggregates into the course-metrics payload (sorted by enrollments). */
export function toCourseMetrics(aggregates: CourseAggregate[]) {
  return aggregates
    .map((c) => ({
      courseId: c.courseId,
      courseTitle: c.courseTitle,
      enrollmentCount: c.enrollmentCount,
      totalContentItems: c.totalContentItems,
      completedItems: c.completedItems,
      averageCompletionRate: c.averageCompletionRate,
      totalTimeSpent: c.totalTimeSpent,
      averageTimeSpent: c.enrollmentCount > 0 ? c.totalTimeSpent / c.enrollmentCount : 0,
    }))
    .sort((a, b) => b.enrollmentCount - a.enrollmentCount);
}
