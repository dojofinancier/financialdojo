import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";
import { CourseProductPage } from "@/components/courses/course-product-page";

type Course = Parameters<typeof CourseProductPage>[0]["course"];

interface CourseProductPageAuthedProps {
  course: Course;
}

export async function CourseProductPageAuthed({ course }: CourseProductPageAuthedProps) {
  // Auth-dependent enrollment check (cookies()) lives behind a Suspense boundary.
  let isEnrolled = false;
  const user = await getCurrentUser();
  if (user) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: course.id,
        expiresAt: { gte: new Date() },
      },
    });
    isEnrolled = !!enrollment;
  }

  return <CourseProductPage course={course} isEnrolled={isEnrolled} />;
}
