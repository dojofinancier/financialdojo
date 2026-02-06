"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { BlogArticle } from "@prisma/client";

/**
 * Get a published article by slug
 * Shows articles that have content (regardless of published status for now)
 */
export async function getArticleBySlug(slug: string) {
  try {
    const article = await prisma.blogArticle.findUnique({
      where: {
        slug,
      },
    });

    // Return article if it's published and has content
    if (article && article.published && article.content) {
      return article;
    }

    return null;
  } catch (error) {
    console.error("Error fetching article:", error);
    return null;
  }
}

/**
 * Get recommended articles based on semantic similarity
 * Uses target_market, tags, and category matching
 */
export async function getRecommendedArticles(
  currentArticleId: string,
  currentArticle: {
    targetMarket: string | null;
    tags: string[];
    category: string | null;
  },
  limit: number = 3
): Promise<BlogArticle[]> {
  try {
    // Build conditions for matching
    const orConditions: any[] = [];

    // Match by target market (case-insensitive comparison)
    if (currentArticle.targetMarket) {
      orConditions.push({
        targetMarket: {
          equals: currentArticle.targetMarket,
          mode: "insensitive",
        },
      });
    }

    // Match by overlapping tags (at least 1 tag in common)
    if (currentArticle.tags.length > 0) {
      orConditions.push({
        tags: {
          hasSome: currentArticle.tags,
        },
      });
    }

    // Match by category
    if (currentArticle.category) {
      orConditions.push({
        category: currentArticle.category,
      });
    }

    // If no conditions, return empty array
    if (orConditions.length === 0) {
      return [];
    }

    const articles = await prisma.blogArticle.findMany({
      where: {
        id: { not: currentArticleId },
        published: true,
        content: { not: null },
        OR: orConditions,
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: limit,
    });

    return articles;
  } catch (error) {
    console.error("Error fetching recommended articles:", error);
    return [];
  }
}

/**
 * Get professional courses for CTA
 */
export async function getProfessionalCourses() {
  try {
    const courses = await prisma.course.findMany({
      where: {
        published: true,
        category: {
          name: "Professionnels",
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        price: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      take: 3,
      orderBy: {
        displayOrder: "asc",
      },
    });

    // Convert Decimal to number
    return courses.map((course) => ({
      ...course,
      price: course.price.toNumber(),
    }));
  } catch (error) {
    console.error("Error fetching professional courses:", error);
    return [];
  }
}

/**
 * Get investor courses for CTA
 */
export async function getInvestorCourses() {
  try {
    const courses = await prisma.course.findMany({
      where: {
        published: true,
        category: {
          name: "Investisseurs",
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        price: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      take: 3,
      orderBy: {
        displayOrder: "asc",
      },
    });

    // Convert Decimal to number
    return courses.map((course) => ({
      ...course,
      price: course.price.toNumber(),
    }));
  } catch (error) {
    console.error("Error fetching investor courses:", error);
    return [];
  }
}

/**
 * Get articles list with pagination and filters
 */
export async function getArticlesList(params: {
  page?: number;
  category?: string;
  search?: string;
  limit?: number;
}) {
  try {
    const page = params.page || 1;
    const limit = params.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {
      published: true,
      content: { not: null },
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { excerpt: { contains: params.search, mode: "insensitive" } },
        { content: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.blogArticle.findMany({
        where,
        orderBy: {
          publishedAt: "desc",
        },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          metaDescription: true,
          category: true,
          tags: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      prisma.blogArticle.count({ where }),
    ]);

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching articles list:", error);
    return {
      articles: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * Get articles for infinite scroll (offset-based)
 */
export async function getArticlesForInfiniteScroll(params: {
  offset?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  try {
    const offset = params.offset || 0;
    const limit = params.limit || 12;

    const where: any = {
      published: true,
      content: { not: null },
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { excerpt: { contains: params.search, mode: "insensitive" } },
        { content: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.blogArticle.findMany({
        where,
        orderBy: {
          publishedAt: "desc",
        },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          metaDescription: true,
          category: true,
          tags: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      prisma.blogArticle.count({ where }),
    ]);

    return {
      articles,
      hasMore: offset + articles.length < total,
      total,
    };
  } catch (error) {
    console.error("Error fetching articles for infinite scroll:", error);
    return {
      articles: [],
      hasMore: false,
      total: 0,
    };
  }
}

/**
 * Get all article categories
 */
export async function getArticleCategories() {
  try {
    const categories = await prisma.blogArticle.findMany({
      where: {
        published: true,
        content: { not: null },
        category: { not: null },
      },
      select: {
        category: true,
      },
      distinct: ["category"],
    });

    return categories
      .map((c) => c.category)
      .filter((c): c is string => c !== null);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

/**
 * Get article suggestions for autocomplete
 */
export async function getArticleSuggestions(query: string, limit: number = 5) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();

    const articles = await prisma.blogArticle.findMany({
      where: {
        published: true,
        content: { not: null },
        OR: [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { excerpt: { contains: searchTerm, mode: "insensitive" } },
          { category: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        excerpt: true,
      },
      take: limit,
      orderBy: {
        publishedAt: "desc",
      },
    });

    return articles;
  } catch (error) {
    console.error("Error fetching article suggestions:", error);
    return [];
  }
}

// calculateReadingTime moved to lib/utils/blog.ts

import { generateEmbedding, prepareTextForEmbedding } from "@/lib/utils/embeddings";
import {
  splitIntoSentences,
  extractKeywordFromContext,
  insertLinksIntoMarkdown,
  validateLinkOpportunity,
  type LinkOpportunity,
} from "@/lib/utils/internal-links";

/**
 * Generate embedding for an article and store it in the database
 */
export async function generateArticleEmbedding(articleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const article = await prisma.blogArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        excerpt: true,
        content: true,
      },
    });

    if (!article) {
      return { success: false, error: "Article not found" };
    }

    if (!article.content) {
      return { success: false, error: "Article has no content" };
    }

    // Prepare text for embedding: title + excerpt + first 500 words
    const excerpt = article.excerpt || "";
    const contentPreview = article.content
      .split(/\s+/)
      .slice(0, 500)
      .join(" ");

    const textToEmbed = [
      article.title,
      excerpt,
      prepareTextForEmbedding(contentPreview),
    ]
      .filter(Boolean)
      .join("\n\n");

    // Generate embedding
    const embedding = await generateEmbedding(textToEmbed);

    // Store embedding in database using raw SQL (Prisma doesn't support vector type)
    // Convert array to PostgreSQL vector format: [1,2,3]::vector
    const vectorString = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE seo_articles 
      SET embedding = ${vectorString}::vector 
      WHERE id = ${articleId}
    `;

    return { success: true };
  } catch (error) {
    console.error("Error generating article embedding:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect opportunities for internal links using semantic similarity
 */
export async function detectInternalLinkOpportunities(
  articleId: string,
  content: string,
  targetLinks: number = 3
): Promise<LinkOpportunity[]> {
  try {
    // Get current article metadata
    const currentArticle = await prisma.blogArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        category: true,
        tags: true,
        targetMarket: true,
        publishedAt: true,
      },
    });

    if (!currentArticle) {
      return [];
    }

    // First, get top candidate articles using the article's embedding (fast, no API calls)
    const candidateArticles = await prisma.$queryRaw<Array<{
      id: string;
      slug: string;
      title: string;
      category: string | null;
      tags: string[];
      target_market: string;
      published_at: Date | null;
      similarity: number;
    }>>`
      SELECT 
        id,
        slug,
        title,
        category,
        tags,
        target_market,
        published_at,
        1 - (embedding <=> (
          SELECT embedding 
          FROM seo_articles 
          WHERE id = ${articleId} 
          AND embedding IS NOT NULL
        )) as similarity
      FROM seo_articles
      WHERE published = true
        AND content IS NOT NULL
        AND embedding IS NOT NULL
        AND id != ${articleId}
      ORDER BY embedding <=> (
        SELECT embedding 
        FROM seo_articles 
        WHERE id = ${articleId} 
        AND embedding IS NOT NULL
      )
      LIMIT 10
    `;

    if (candidateArticles.length === 0) {
      return [];
    }

    // Filter candidates by minimum similarity threshold
    const validCandidates = candidateArticles.filter((c) => c.similarity >= 0.65);
    if (validCandidates.length === 0) {
      return [];
    }

    // Split content into sentences
    const sentences = splitIntoSentences(content);
    if (sentences.length === 0) {
      return [];
    }

    // Process sentences and find link opportunities
    // Use article-level similarity and match based on keyword extraction (no sentence embeddings needed)
    const opportunities: LinkOpportunity[] = [];
    const usedTargetSlugs = new Set<string>();

    // Sort candidates by similarity (best first)
    const sortedCandidates = [...validCandidates].sort((a, b) => b.similarity - a.similarity);

    for (const sentence of sentences) {
      if (opportunities.length >= targetLinks) {
        break;
      }

      // Try to match sentence to best available candidate
      for (const candidate of sortedCandidates) {
        // Skip if we've already linked to this article
        if (usedTargetSlugs.has(candidate.slug)) {
          continue;
        }

        // Extract keyword from context
        const keyword = extractKeywordFromContext(sentence.text, candidate.title);

        if (keyword) {
          // Calculate relevance score with bonuses
          let relevanceScore = candidate.similarity;

          // Category match bonus
          if (
            currentArticle.category &&
            candidate.category === currentArticle.category
          ) {
            relevanceScore += 0.1;
          }

          // Tag overlap bonus
          const commonTags = currentArticle.tags.filter((tag) =>
            candidate.tags.includes(tag)
          );
          relevanceScore += commonTags.length * 0.05;

          // Target market match bonus
          if (currentArticle.targetMarket === candidate.target_market) {
            relevanceScore += 0.1;
          }

          // Recency bonus (published within last 6 months)
          if (candidate.published_at) {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (candidate.published_at > sixMonthsAgo) {
              relevanceScore += 0.05;
            }
          }

          // Find position of keyword in sentence
          const keywordIndex = sentence.text
            .toLowerCase()
            .indexOf(keyword.toLowerCase());

          if (keywordIndex !== -1) {
            const position = sentence.startIndex + keywordIndex;

            const opportunity: LinkOpportunity = {
              keyword,
              targetSlug: candidate.slug,
              targetTitle: candidate.title,
              position,
              context: sentence.text,
              similarityScore: candidate.similarity,
              relevanceScore: Math.min(relevanceScore, 1.0), // Cap at 1.0
            };

            if (validateLinkOpportunity(opportunity, content)) {
              opportunities.push(opportunity);
              usedTargetSlugs.add(candidate.slug);
              break; // Move to next sentence
            }
          }
        }
      }
    }

    // Sort by relevance score and return top opportunities
    return opportunities
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, targetLinks);
  } catch (error) {
    console.error("Error detecting internal link opportunities:", error);
    return [];
  }
}

/**
 * Insert internal links into article markdown content
 */
export async function insertInternalLinks(
  articleId: string,
  linkOpportunities: Array<{
    keyword: string;
    targetSlug: string;
    position: number;
  }>
): Promise<{ success: boolean; updatedContent: string; linksInserted: number; error?: string }> {
  try {
    const article = await prisma.blogArticle.findUnique({
      where: { id: articleId },
      select: { content: true },
    });

    if (!article || !article.content) {
      return {
        success: false,
        updatedContent: "",
        linksInserted: 0,
        error: "Article not found or has no content",
      };
    }

    // Convert to LinkOpportunity format
    const opportunities: LinkOpportunity[] = linkOpportunities.map((link) => ({
      ...link,
      targetTitle: "",
      context: "",
      similarityScore: 0,
      relevanceScore: 0,
    }));

    // Insert links
    const updatedContent = insertLinksIntoMarkdown(
      article.content,
      opportunities
    );

    // Update article content
    await prisma.blogArticle.update({
      where: { id: articleId },
      data: { content: updatedContent },
    });

    // Store link metadata
    const metadata = linkOpportunities.map((link) => ({
      targetSlug: link.targetSlug,
      anchorText: link.keyword,
      position: link.position,
    }));

    await prisma.$executeRaw`
      UPDATE seo_articles 
      SET internal_links_metadata = ${JSON.stringify(metadata)}::jsonb
      WHERE id = ${articleId}
    `;

    return {
      success: true,
      updatedContent,
      linksInserted: linkOpportunities.length,
    };
  } catch (error) {
    console.error("Error inserting internal links:", error);
    return {
      success: false,
      updatedContent: "",
      linksInserted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch generate embeddings for all published articles
 */
export async function batchGenerateEmbeddings(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ processed: number; errors: number }> {
  try {
    const articles = await prisma.blogArticle.findMany({
      where: {
        published: true,
        content: { not: null },
      },
      select: {
        id: true,
        title: true,
        excerpt: true,
        content: true,
      },
      take: options?.limit,
      skip: options?.offset,
    });

    let processed = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        const result = await generateArticleEmbedding(article.id);
        if (result.success) {
          processed++;
        } else {
          errors++;
          console.error(
            `Failed to generate embedding for article ${article.id}:`,
            result.error
          );
        }
      } catch (error) {
        errors++;
        console.error(
          `Error processing article ${article.id}:`,
          error
        );
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error("Error in batch generate embeddings:", error);
    return { processed: 0, errors: 0 };
  }
}
