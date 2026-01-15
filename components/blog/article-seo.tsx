import type { BlogArticle } from "@prisma/client";

interface ArticleSEOProps {
  article: BlogArticle;
}

export function ArticleSEO({ article }: ArticleSEOProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ledojofinancier.com";
  const articleUrl = `${siteUrl}/article/${article.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription || article.excerpt || "",
    image: undefined, // Add when featured images are available
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt?.toISOString() || article.publishedAt?.toISOString(),
    author: {
      "@type": "Organization",
      name: "Le Dojo Financier",
    },
    publisher: {
      "@type": "Organization",
      name: "Le Dojo Financier",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo_light.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    keywords: article.secondaryKeywords && article.secondaryKeywords.length > 0 ? article.secondaryKeywords.join(", ") : undefined,
    articleSection: article.category || undefined,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: `${siteUrl}/article`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
