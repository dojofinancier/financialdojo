import { getPublishedCohortBySlugAction } from "@/app/actions/cohorts";
import { notFound } from "next/navigation";
import { CohortProductPage } from "@/components/cohorts/cohort-product-page";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { BrutalistNavbar } from "@/components/layout/brutalist-navbar";
import { BrutalistNavbarClient } from "@/components/layout/brutalist-navbar-client";

interface CohortDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function CohortDetailContent({ params }: CohortDetailPageProps) {
  const { slug } = await params;
  const cohort = await getPublishedCohortBySlugAction(slug);

  if (!cohort) {
    notFound();
  }

  // Check if user is enrolled (optional, for showing different CTA)
  let isEnrolled = false;
  try {
    const user = await getCurrentUser();
    if (user) {
      const enrollment = await prisma.cohortEnrollment.findFirst({
        where: {
          userId: user.id,
          cohortId: cohort.id,
          expiresAt: { gte: new Date() },
        },
      });
      isEnrolled = !!enrollment;
    }
  } catch {
    // User not authenticated, that's fine
  }

  return <CohortProductPage cohort={cohort} isEnrolled={isEnrolled} />;
}

export default function CohortDetailPage(props: CohortDetailPageProps) {
  return (
    <>
      <Suspense
        fallback={<BrutalistNavbarClient user={undefined} variant="transparent" dashboardUrl={null} />}
      >
        <BrutalistNavbar variant="transparent" />
      </Suspense>
      <Suspense
        fallback={
          <div className="container mx-auto p-6">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        }
      >
        <CohortDetailContent {...props} />
      </Suspense>
    </>
  );
}
