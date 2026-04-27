import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleBySlug, getRecommendedArticles, getCTACourses } from "@/app/actions/blog";
import { calculateReadingTime } from "@/lib/utils/blog";
import { ArticlePage } from "@/components/blog/article-page";
import { ArticleSEO } from "@/components/blog/article-seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article not found | Financial Dojo",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca";
  const articleUrl = `${siteUrl}/article/${article.slug}`;
  const description = article.metaDescription || article.excerpt || "";

  return {
    title: `${article.title} | Financial Dojo`,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString() || article.publishedAt?.toISOString(),
      url: articleUrl,
      siteName: "Financial Dojo",
      // Add image when available
      // images: article.featuredImage ? [{ url: article.featuredImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      // Add image when available
      // images: article.featuredImage ? [article.featuredImage] : [],
    },
    alternates: {
      canonical: articleUrl,
    },
    robots: {
      index: article.published === true,
      follow: true,
    },
    keywords: article.secondaryKeywords && article.secondaryKeywords.length > 0 ? article.secondaryKeywords : undefined,
  };
}

export default async function ArticlePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // Get recommended articles
  const recommendedArticles = await getRecommendedArticles(
    article.id,
    {
      targetMarket: article.targetMarket,
      tags: article.tags,
      category: article.category,
    },
    3
  );

  // Get courses for CTA
  const courses = await getCTACourses();

  const readingTime = calculateReadingTime(article.content || "");

  return (
    <>
      <ArticleSEO article={article} />
      <ArticlePage
        article={article}
        recommendedArticles={recommendedArticles}
        courses={courses}
        readingTime={readingTime}
      />
    </>
  );
}
