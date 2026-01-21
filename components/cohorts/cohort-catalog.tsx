"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { stripHtmlAndDecode } from "@/lib/utils/html";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

type Cohort = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  maxStudents: number;
  enrollmentClosingDate: Date;
  accessDuration: number;
  _count: {
    enrollments: number;
  };
};

interface CohortCatalogProps {
  initialCohorts: Cohort[];
}

export function CohortCatalog({ initialCohorts }: CohortCatalogProps) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const spotsRemaining = (cohort: Cohort) => {
    return cohort.maxStudents - cohort._count.enrollments;
  };

  // Filter cohorts where enrollment is still open (client-side)
  const now = new Date();
  const openCohorts = initialCohorts.filter(
    (cohort) => new Date(cohort.enrollmentClosingDate) >= now
  );

  return (
    <div className="space-y-10">
      {/* Cohort Grid */}
      {openCohorts.length === 0 ? (
        <div className="border-4 border-black p-10 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 mb-3">
            [0 résultat]
          </div>
          <div className="text-2xl font-black uppercase tracking-tight">
            Aucune cohorte disponible
          </div>
        </div>
      ) : (
        <div className="grid gap-0 border-4 border-black md:grid-cols-2 lg:grid-cols-3">
          {openCohorts.map((cohort, idx) => {
            const cohortHref = `/cohorts/${cohort.slug || cohort.id}`;
            const isRightEdgeLg = (idx + 1) % 3 === 0;
            const isRightEdgeMd = (idx + 1) % 2 === 0;
            const spots = spotsRemaining(cohort);

            return (
              <Link
                key={cohort.id}
                href={cohortHref}
                prefetch={true}
                onMouseEnter={() => router.prefetch(cohortHref)}
                className={[
                  "group relative p-8 sm:p-10 bg-white text-black transition-all duration-150",
                  "border-b-4 border-black",
                  "hover:z-10 hover:scale-[1.01] hover:shadow-[12px_12px_0_0_black]",
                  // vertical dividers
                  "md:border-r-4 md:border-black",
                  // remove right border on end-of-row
                  isRightEdgeMd ? "md:border-r-0" : "",
                  "lg:border-r-4",
                  isRightEdgeLg ? "lg:border-r-0" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4 mb-8">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60">
                        Cohorte professionnelle
                      </div>
                    </div>
                    {spots > 0 ? (
                      <div className="mt-2 inline-block border-2 border-black px-2 py-1 font-mono text-xs uppercase tracking-wider bg-primary text-black">
                        {spots} place{spots !== 1 ? "s" : ""} disponible{spots !== 1 ? "s" : ""}
                      </div>
                    ) : (
                      <div className="mt-2 inline-block border-2 border-black px-2 py-1 font-mono text-xs uppercase tracking-wider bg-black text-white">
                        Complet
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/40">
                    #{String(idx + 1).padStart(2, "0")}
                  </div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-[1.05]">
                  {cohort.title}
                </h3>

                <p className="mt-4 text-base leading-relaxed opacity-80 line-clamp-4">
                  {cohort.description ? stripHtmlAndDecode(cohort.description) : "Aucune description disponible"}
                </p>

                <div className="mt-8 border-t-4 border-black pt-6 flex items-end justify-between gap-6">
                  <div>
                    <div className="text-3xl font-black">
                      {formatCurrency(Number(cohort.price))}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-2">
                      Clôture: {formatDate(cohort.enrollmentClosingDate)} ·{" "}
                      {cohort.accessDuration} jour{cohort.accessDuration !== 1 ? "s" : ""} d'accès
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                    Détails <span className="text-2xl">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
