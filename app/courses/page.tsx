import { getPublishedCoursesAction } from "@/app/actions/courses";
import { getPublishedCohortsAction } from "@/app/actions/cohorts";
import { CourseCatalog } from "@/components/courses/course-catalog";
import { CohortCatalog } from "@/components/cohorts/cohort-catalog";
import { Suspense } from "react";

async function CoursesSection() {
  const courses = await getPublishedCoursesAction({});
  return (
    <section className="bg-white text-black border-t-4 border-black">
      <div className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto">
          <CourseCatalog initialCourses={courses.items} />
        </div>
      </div>
    </section>
  );
}

async function CohortsSection() {
  const cohorts = await getPublishedCohortsAction();

  if (cohorts.items.length === 0) {
    return null;
  }

  return (
    <section id="cohortes" className="bg-black text-white border-t-4 border-white">
      <div className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-10">
            <span className="text-primary font-mono text-sm uppercase tracking-[0.3em] block mb-4">
              [PROFESSIONAL COHORTS]
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-4">
              COHORTS
              <br />
              <span className="text-primary">PROFESSIONAL</span>
            </h2>
            <div className="max-w-2xl mt-4">
              <div className="border-l-4 border-primary pl-6 py-2">
                <p className="text-lg sm:text-xl font-light leading-relaxed opacity-80">
                  Group training with personalized support and coaching sessions.
                </p>
              </div>
            </div>
          </div>
          <CohortCatalog initialCohorts={cohorts.items} />
        </div>
      </div>
    </section>
  );
}

export default function CoursesPage() {
  return (
    <>
      <main className="bg-black text-white">
        {/* HERO */}
        <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20" data-nav-hero>
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(white 2px, transparent 2px),
                linear-gradient(90deg, white 2px, transparent 2px)
              `,
              backgroundSize: "80px 80px",
            }}
          />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-primary transform origin-top-right skew-x-[-12deg] translate-x-1/3" />

          <div className="relative px-4 sm:px-8">
            <div className="max-w-[1400px] mx-auto">
              <span className="text-primary font-mono text-sm uppercase tracking-[0.3em] block mb-4">
                [CATALOG]
              </span>
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9]">
                FINANCE
                <br />
                <span className="text-primary">COURSES</span>
              </h1>
              <div className="max-w-2xl mt-8">
                <div className="border-l-4 border-primary pl-6 py-2">
                  <p className="text-xl sm:text-2xl font-light leading-relaxed opacity-80">
                    OCRI, AMF, CSI tracks. Pick your target and go.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COURSES CATALOG */}
        <Suspense
          fallback={
            <section className="bg-white text-black border-t-4 border-black">
              <div className="px-4 sm:px-8 py-12 sm:py-16">
                <div className="max-w-[1400px] mx-auto">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            </section>
          }
        >
          <CoursesSection />
        </Suspense>

        {/* COHORTES CATALOG */}
        <Suspense
          fallback={
            <section id="cohortes" className="bg-black text-white border-t-4 border-white">
              <div className="px-4 sm:px-8 py-12 sm:py-16">
                <div className="max-w-[1400px] mx-auto">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-700 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            </section>
          }
        >
          <CohortsSection />
        </Suspense>
      </main>
    </>
  );
}
