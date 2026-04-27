/**
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
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function getOrganizationSchemaId(): string {
  return `${getSiteOrigin()}${ORGANIZATION_ID_FRAGMENT}`;
}

export function toAbsoluteUrl(pathOrUrl: string, origin = getSiteOrigin()): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return origin;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
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
      url: `${origin}/logo_light.png`,
    },
  };
}

export function buildWebSiteJsonLd() {
  const origin = getSiteOrigin();
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
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
        urlTemplate: `${origin}/article?search={search_term_string}`,
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
