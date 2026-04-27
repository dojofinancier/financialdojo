import { getSiteOrigin } from "@/lib/seo/json-ld";

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
      url: `${origin}/article/${a.slug}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
