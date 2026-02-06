import type { BlogArticle } from "@prisma/client";
import Link from "next/link";
import { RecommendedArticles } from "./recommended-articles";
import { ArticleCTA } from "./article-cta";
import { ArticleContent } from "./article-content";
import { Clock, Calendar, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ArticlePageProps {
  article: BlogArticle;
  recommendedArticles: BlogArticle[];
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
  }> | null;
  readingTime: number;
}

export function ArticlePage({ article, recommendedArticles, courses, readingTime }: ArticlePageProps) {
  const publishedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : null;

  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-8">
            {/* Breadcrumbs */}
            <nav className="mb-6 text-sm text-gray-600">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href="/" className="hover:text-gray-900">
                    Home
                  </Link>
                </li>
                <li>/</li>
                <li>
                  <Link href="/article" className="hover:text-gray-900">
                    Articles
                  </Link>
                </li>
                <li>/</li>
                <li className="text-gray-900 font-medium">{article.title}</li>
              </ol>
            </nav>

            {/* Category and Tags */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {article.category && (
                <Badge variant="outline" className="text-xs">
                  {article.category}
                </Badge>
              )}
              {article.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Article Header */}
            <header className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
                {article.h1 || article.title}
              </h1>

              {/* Meta Information */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
                {publishedDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <time dateTime={article.publishedAt?.toISOString()}>{publishedDate}</time>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{readingTime} min read</span>
                </div>
              </div>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="text-xl text-gray-700 leading-relaxed mb-6">{article.excerpt}</p>
              )}
            </header>

            <Separator className="mb-8" />

            {/* Article Content */}
            {article.content && <ArticleContent content={article.content} />}

            <Separator className="my-12" />

            {/* CTA Section */}
            {courses && courses.length > 0 && (
              <ArticleCTA courses={courses} targetMarket={article.targetMarket} />
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-8">
              <RecommendedArticles articles={recommendedArticles} />
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
