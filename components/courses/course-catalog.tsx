"use client";

import { useMemo, useState } from "react";
import { getPublishedCoursesAction } from "@/app/actions/courses";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { stripHtmlAndDecode } from "@/lib/utils/html";
import { useRouter } from "next/navigation";

type Course = {
  id: string;
  code: string | null;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  paymentType: string;
  category: {
    id: string;
    name: string;
  };
  _count: {
    enrollments: number;
    modules: number;
  };
};

interface CourseCatalogProps {
  initialCourses: Course[];
}

export function CourseCatalog({ initialCourses }: CourseCatalogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState(initialCourses);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) {
      setCourses(initialCourses);
      return;
    }

    setLoading(true);
    try {
      const result = await getPublishedCoursesAction({ search });
      setCourses(result.items);
    } catch (error) {
      console.error("Error searching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses;
    return courses;
  }, [courses, search]);

  return (
    <div className="space-y-10">
      {/* Search (brutalist) */}
      <div className="border-4 border-black p-4 sm:p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <label className="block font-mono text-xs uppercase tracking-[0.25em] text-black/60 mb-2">
              Rechercher
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Title, description, code..."
              className="w-full bg-white text-black font-mono px-4 py-4 border-4 border-black focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="bg-black text-white font-black uppercase tracking-wider px-8 py-4 border-4 border-black hover:bg-primary hover:text-black hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Searching..." : "Search →"}
          </button>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="border-4 border-black p-10 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 mb-3">
            [0 results]
          </div>
          <div className="text-2xl font-black uppercase tracking-tight">
            No courses found
          </div>
        </div>
      ) : (
        <div className="grid gap-0 border-4 border-black md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course, idx) => {
            const courseHref = `/courses/${course.slug || course.id}`;
            const isRightEdgeLg = (idx + 1) % 3 === 0;
            const isRightEdgeMd = (idx + 1) % 2 === 0;

            return (
              <Link
                key={course.id}
                href={courseHref}
                prefetch={true}
                onMouseEnter={() => router.prefetch(courseHref)}
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
                    <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60">
                      {course.category.name}
                    </div>
                    {course.code ? (
                      <div className="mt-2 inline-block border-2 border-black px-2 py-1 font-mono text-xs uppercase tracking-wider">
                        {course.code}
                      </div>
                    ) : null}
                  </div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/40">
                    #{String(idx + 1).padStart(2, "0")}
                  </div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-[1.05]">
                  {course.title}
                </h3>

                <p className="mt-4 text-base leading-relaxed opacity-80 line-clamp-4">
                  {course.description ? stripHtmlAndDecode(course.description) : "No description available"}
                </p>

                <div className="mt-8 border-t-4 border-black pt-6 flex items-end justify-between gap-6">
                  <div>
                    <div className="text-3xl font-black">
                      {formatCurrency(Number(course.price))}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-2">
                      {course.paymentType === "SUBSCRIPTION" ? "Subscription" : "One-time payment"} ·{" "}
                      {course._count.modules} module{course._count.modules !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                    Details <span className="text-2xl">→</span>
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
