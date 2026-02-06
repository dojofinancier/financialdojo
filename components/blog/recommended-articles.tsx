import type { BlogArticle } from "@prisma/client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface RecommendedArticlesProps {
  articles: BlogArticle[];
}

export function RecommendedArticles({ articles }: RecommendedArticlesProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
      <div className="space-y-4">
        {articles.map((article) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                    {article.excerpt}
                  </p>
                )}
                <div className="flex items-center text-sm text-primary font-medium">
                  Read article
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
