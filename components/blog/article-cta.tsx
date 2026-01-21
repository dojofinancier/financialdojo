// targetMarket is a string: "professionals", "investors", "entrepreneurs", "general"
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/format";
import { ArrowRight } from "lucide-react";

interface ArticleCTAProps {
  courses: Array<{
    id: string;
    title: string;
    slug: string | null;
    shortDescription: string | null;
    price: number;
    category: {
      name: string;
      slug: string;
    };
  }>;
  targetMarket: string | null;
}

export function ArticleCTA({ courses, targetMarket }: ArticleCTAProps) {
  const getCTATitle = () => {
    const market = targetMarket?.toLowerCase();
    switch (market) {
      case "professionals":
        return "Recommended professional courses";
      case "investors":
        return "Formations pour investisseurs";
      case "entrepreneurs":
        return "Formations pour entrepreneurs";
      default:
        return "Recommended courses";
    }
  };

  const getCTADescription = () => {
    const market = targetMarket?.toLowerCase();
    switch (market) {
      case "professionals":
        return "Discover our professional courses designed to develop your financial skills.";
      case "investors":
        return "Explore our courses specifically designed for investors.";
      case "entrepreneurs":
        return "Develop your financial skills with our courses for entrepreneurs.";
      default:
        return "Discover our courses to deepen your knowledge.";
    }
  };

  return (
    <section className="my-12 p-8 bg-gray-50 rounded-lg border-2 border-gray-200">
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">{getCTATitle()}</h2>
        <p className="text-gray-600">{getCTADescription()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {courses.map((course) => (
          <Card key={course.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
              {course.shortDescription && (
                <CardDescription className="line-clamp-3">
                  {course.shortDescription}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-2xl font-bold text-primary mb-4">
                {formatCurrency(course.price)}
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant="default">
                <Link href={course.slug ? `/courses/${course.slug}` : `/courses/${course.id}`}>
                  En savoir plus
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/courses">
            Voir toutes les formations
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
