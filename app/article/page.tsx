import type { Metadata } from "next";
import { getArticlesList, getArticleCategories } from "@/app/actions/blog";
import { ArticleList } from "@/components/blog/article-list";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles | Le Dojo Financier",
  description: "Discover our articles on finance, investing, and financial management.",
  openGraph: {
    title: "Articles | Le Dojo Financier",
    description: "Discover our articles on finance, investing, and financial management.",
    type: "website",
  },
};

interface ArticlePageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    search?: string;
  }>;
}

async function ArticleListContent({ searchParams }: { searchParams: Promise<{ page?: string; category?: string; search?: string }> }) {
  const params = await searchParams;
  const category = params.category;
  const search = params.search;

  const [result, categories] = await Promise.all([
    getArticlesList({
      page: 1,
      category,
      search,
      limit: 12,
    }),
    getArticleCategories(),
  ]);

  return (
    <ArticleList
      initialArticles={result.articles}
      initialTotal={result.pagination.total}
      categories={categories}
      currentCategory={category}
      currentSearch={search}
    />
  );
}

export default async function ArticleListingPage({ searchParams }: ArticlePageProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Articles</h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Explore our articles on finance, investing, and financial management.
          </p>
        </header>

        {/* Article List */}
        <Suspense fallback={<ArticleListSkeleton />}>
          <ArticleListContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function ArticleListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
