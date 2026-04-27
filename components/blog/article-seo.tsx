import type { BlogArticle } from "@prisma/client";
import { getOrganizationSchemaId, getSiteOrigin, toAbsoluteUrl } from "@/lib/seo/json-ld";

interface ArticleSEOProps {
  article: BlogArticle;
}

function toIsoString(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const ms = new Date(d).getTime();
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}

/** First <img src="..."> in HTML body, if any (must match visible content). */
function firstImageSrcFromHtml(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const src = m?.[1]?.trim();
  return src || undefined;
}

export function ArticleSEO({ article }: ArticleSEOProps) {
  const origin = getSiteOrigin();
  const articleUrl = `${origin}/article/${article.slug}`;
  const orgId = getOrganizationSchemaId();

  const description = (article.metaDescription || article.excerpt || "").trim();
  const imgSrc = firstImageSrcFromHtml(article.content);
  const image = imgSrc ? [toAbsoluteUrl(imgSrc, origin)] : undefined;

  const datePublished = toIsoString(article.publishedAt);
  const dateModified = toIsoString(article.updatedAt) ?? datePublished;

  const articleNode: Record<string, unknown> = {
    "@type": ["BlogPosting", "Article"],
    headline: article.title,
    ...(description ? { description } : {}),
    url: articleUrl,
    inLanguage: "en-CA",
    ...(image ? { image } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: { "@id": orgId },
    publisher: { "@id": orgId },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    ...(article.secondaryKeywords?.length
      ? { keywords: article.secondaryKeywords.join(", ") }
      : {}),
    ...(article.category ? { articleSection: article.category } : {}),
    ...(article.published === true ? { isAccessibleForFree: true } : {}),
  };

  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: origin,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: `${origin}/article`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  const payload = {
    "@context": "https://schema.org",
    "@graph": [articleNode, breadcrumbNode],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
