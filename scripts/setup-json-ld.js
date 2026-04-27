
const fs = require("fs");
const path = require("path");

const basePath = path.join("c:", "Users", "User", "Desktop", "financial_dojo");

// 1. Create lib/seo/json-ld.ts
const seoDir = path.join(basePath, "lib", "seo");
if (!fs.existsSync(seoDir)) {
  fs.mkdirSync(seoDir, { recursive: true });
}

const jsonLdTsPath = path.join(seoDir, "json-ld.ts");
const jsonLdTsContent = `/**
 * Shared JSON-LD helpers for site-wide Organization / WebSite graph.
 * Organization @id must match references from BlogPosting, Course, etc.
 */

const DEFAULT_SITE_ORIGIN = "https://financedojo.ca";

export const SITE_ORGANIZATION_NAME = "Financial Dojo";

/** Stable fragment for JSON-LD @id (must be consistent site-wide). */
export const ORGANIZATION_ID_FRAGMENT = "#organization";

export function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    const url = new URL(raw.startsWith("http") ? raw : \`https://\${raw}\`);
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function getOrganizationSchemaId(): string {
  return \`\${getSiteOrigin()}\${ORGANIZATION_ID_FRAGMENT}\`;
}

export function toAbsoluteUrl(pathOrUrl: string, origin = getSiteOrigin()): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return origin;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : \`/\${trimmed}\`;
  return \`\${origin}\${path}\`;
}

export function buildOrganizationJsonLd() {
  const origin = getSiteOrigin();
  return {
    "@type": "Organization",
    "@id": getOrganizationSchemaId(),
    name: SITE_ORGANIZATION_NAME,
    url: origin,
    logo: {
      "@type": "ImageObject",
      url: \`\${origin}/logo_light.png\`,
    },
  };
}

export function buildWebSiteJsonLd() {
  const origin = getSiteOrigin();
  return {
    "@type": "WebSite",
    "@id": \`\${origin}/#website\`,
    url: origin,
    name: SITE_ORGANIZATION_NAME,
    publisher: {
      "@id": getOrganizationSchemaId(),
    },
    inLanguage: "en-CA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: \`\${origin}/article?search={search_term_string}\`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildSiteWideJsonLdGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [buildOrganizationJsonLd(), buildWebSiteJsonLd()],
  };
}
`;
fs.writeFileSync(jsonLdTsPath, jsonLdTsContent);

// 2. Modify app/layout.tsx
const layoutTsxPath = path.join(basePath, "app", "layout.tsx");
let layoutTsx = fs.readFileSync(layoutTsxPath, "utf8");
if (!layoutTsx.includes("buildSiteWideJsonLdGraph")) {
  layoutTsx = layoutTsx.replace(
    `import { RouteChrome } from "@/components/layout/route-chrome";`,
    `import { RouteChrome } from "@/components/layout/route-chrome";\nimport { buildSiteWideJsonLdGraph } from "@/lib/seo/json-ld";`
  );
  layoutTsx = layoutTsx.replace(
    `<link rel="dns-prefetch" href="https://m.stripe.network" />`,
    `<link rel="dns-prefetch" href="https://m.stripe.network" />\n\n        <script\n          type="application/ld+json"\n          dangerouslySetInnerHTML={{\n            __html: JSON.stringify(buildSiteWideJsonLdGraph()),\n          }}\n        />`
  );
  fs.writeFileSync(layoutTsxPath, layoutTsx);
}

// 3. Overwrite components/blog/article-seo.tsx
const articleSeoTsxPath = path.join(basePath, "components", "blog", "article-seo.tsx");
const articleSeoTsxContent = `import type { BlogArticle } from "@prisma/client";
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
  const articleUrl = \`\${origin}/article/\${article.slug}\`;
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
        item: \`\${origin}/article\`,
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
`;
fs.writeFileSync(articleSeoTsxPath, articleSeoTsxContent);

// 4. Create components/courses/course-json-ld.tsx
const coursesDir = path.join(basePath, "components", "courses");
if (!fs.existsSync(coursesDir)) {
  fs.mkdirSync(coursesDir, { recursive: true });
}

const courseJsonLdTsxPath = path.join(coursesDir, "course-json-ld.tsx");
const courseJsonLdTsxContent = `import { getOrganizationSchemaId, getSiteOrigin, toAbsoluteUrl } from "@/lib/seo/json-ld";

function toPlainText(htmlOrText: string | null | undefined, maxLen = 8000): string {
  if (!htmlOrText?.trim()) return "";
  return htmlOrText
    .replace(/<[^>]*>/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export interface CourseJsonLdCourseInput {
  title: string;
  shortDescription: string | null;
  description: string | null;
  slug: string | null;
  price: number;
  heroImages: string[];
}

interface CourseJsonLdProps {
  course: CourseJsonLdCourseInput;
}

/**
 * Course structured data for public formation product pages.
 */
export function CourseJsonLd({ course }: CourseJsonLdProps) {
  const origin = getSiteOrigin();
  const slug = course.slug?.trim();
  if (!slug) return null;

  const pageUrl = \`\${origin}/courses/\${slug}\`;
  const plainDescription =
    toPlainText(course.shortDescription) || toPlainText(course.description) || course.title;

  const firstHero = course.heroImages?.find((u) => typeof u === "string" && u.trim());
  const image = firstHero ? toAbsoluteUrl(firstHero, origin) : undefined;

  const courseNode: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": \`\${pageUrl}#course\`,
    name: course.title,
    description: plainDescription,
    url: pageUrl,
    provider: {
      "@id": getOrganizationSchemaId(),
    },
    ...(image ? { image } : {}),
    offers: {
      "@type": "Offer",
      price: typeof course.price === "number" ? course.price.toFixed(2) : parseFloat(course.price as unknown as string).toFixed(2),
      priceCurrency: "CAD",
      url: pageUrl,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(courseNode) }}
    />
  );
}
`;
fs.writeFileSync(courseJsonLdTsxPath, courseJsonLdTsxContent);

// 5. Update app/courses/[courseId]/page.tsx
const coursePageTsxPath = path.join(basePath, "app", "courses", "[courseId]", "page.tsx");
let coursePageTsx = fs.readFileSync(coursePageTsxPath, "utf8");
if (!coursePageTsx.includes("CourseJsonLd")) {
  coursePageTsx = coursePageTsx.replace(
    `import { CourseProductPageAuthed } from "./course-product-page-authed";`,
    `import { CourseProductPageAuthed } from "./course-product-page-authed";\nimport { CourseJsonLd } from "@/components/courses/course-json-ld";`
  );
  coursePageTsx = coursePageTsx.replace(
    `return (\n    <Suspense fallback={<CourseProductPage course={courseWithDefaults} isEnrolled={false} />}>`,
    `return (\n    <>\n      <CourseJsonLd course={courseWithDefaults as any} />\n      <Suspense fallback={<CourseProductPage course={courseWithDefaults} isEnrolled={false} />}>`
  );
  coursePageTsx = coursePageTsx.replace(
    `    </Suspense>\n  );`,
    `    </Suspense>\n    </>\n  );`
  );
  fs.writeFileSync(coursePageTsxPath, coursePageTsx);
}

// 6. Create components/blog/article-listing-json-ld.tsx
const articleListingJsonLdTsxPath = path.join(basePath, "components", "blog", "article-listing-json-ld.tsx");
const articleListingJsonLdTsxContent = `import { getSiteOrigin } from "@/lib/seo/json-ld";

type ListingArticle = {
  title: string;
  slug: string;
};

interface ArticleListingJsonLdProps {
  articles: ListingArticle[];
}

/**
 * ItemList for the first server-rendered batch of articles.
 */
export function ArticleListingJsonLd({ articles }: ArticleListingJsonLdProps) {
  const origin = getSiteOrigin();
  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((a, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: a.title,
      url: \`\${origin}/article/\${a.slug}\`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
`;
fs.writeFileSync(articleListingJsonLdTsxPath, articleListingJsonLdTsxContent);

// 7. Update app/article/page.tsx
const articlePageTsxPath = path.join(basePath, "app", "article", "page.tsx");
let articlePageTsx = fs.readFileSync(articlePageTsxPath, "utf8");
if (!articlePageTsx.includes("ArticleListingJsonLd")) {
  articlePageTsx = articlePageTsx.replace(
    `import { Suspense } from "react";`,
    `import { Suspense } from "react";\nimport { ArticleListingJsonLd } from "@/components/blog/article-listing-json-ld";`
  );
  articlePageTsx = articlePageTsx.replace(
    `  return (\n    <ArticleList\n      initialArticles={result.articles}`,
    `  return (\n    <>\n      <ArticleListingJsonLd articles={result.articles} />\n      <ArticleList\n        initialArticles={result.articles}`
  );
  articlePageTsx = articlePageTsx.replace(
    `      currentSearch={search}\n    />\n  );`,
    `      currentSearch={search}\n      />\n    </>\n  );`
  );
  fs.writeFileSync(articlePageTsxPath, articlePageTsx);
}

console.log("JSON-LD scripts setup perfectly.");

