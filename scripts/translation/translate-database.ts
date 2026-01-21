/**
 * Translates database content from French to English.
 * Run with: tsx scripts/translation/translate-database.ts
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { loadEnv } from "./translation-utils";

const MODEL = "gpt-5-mini";
const translationCache = new Map<string, string>();

function getEnvValue(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing in the environment.`);
  return value;
}

async function translateText(openai: OpenAI, text: string, context: string) {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const cacheKey = `${context}::${trimmed}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a precise translation engine. Respond only with the translated text.",
      },
      {
        role: "user",
        content: `Translate this French text to English for a financial education platform. Context: ${context}. Always translate \"Le Dojo Financier\" or \"Dojo Financier\" as \"Financial Dojo\".\n\nText: "${text}"`,
      },
    ],
  });

  const translated = response.choices[0]?.message?.content?.trim() || text;
  translationCache.set(cacheKey, translated);
  return translated;
}

async function translateCourseCategories(
  openai: OpenAI,
  sourcePrisma: PrismaClient,
  targetPrisma: PrismaClient,
) {
  const categories = await sourcePrisma.courseCategory.findMany();
  for (const category of categories) {
    const translatedName = await translateText(
      openai,
      category.name,
      "course category name",
    );
    const translatedDescription = category.description
      ? await translateText(
          openai,
          category.description,
          "course category description",
        )
      : null;

    await targetPrisma.courseCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: translatedName,
        description: translatedDescription,
      },
      create: {
        slug: category.slug,
        name: translatedName,
        description: translatedDescription,
      },
    });
  }
  console.log(`Translated ${categories.length} course categories`);
}

async function translateCourseFAQs(
  openai: OpenAI,
  sourcePrisma: PrismaClient,
  targetPrisma: PrismaClient,
) {
  const faqs = await sourcePrisma.courseFAQ.findMany({
    include: { course: { select: { slug: true } } },
  });

  for (const faq of faqs) {
    const courseSlug = faq.course?.slug;
    if (!courseSlug) {
      console.warn(`Skipping course FAQ ${faq.id} - missing course slug`);
      continue;
    }

    const targetCourse = await targetPrisma.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true },
    });

    if (!targetCourse) {
      console.warn(`Skipping course FAQ ${faq.id} - no target course for ${courseSlug}`);
      continue;
    }

    const translatedQuestion = await translateText(
      openai,
      faq.question,
      "course FAQ question",
    );
    const translatedAnswer = await translateText(
      openai,
      faq.answer,
      "course FAQ answer",
    );

    const existing = await targetPrisma.courseFAQ.findFirst({
      where: {
        courseId: targetCourse.id,
        order: faq.order,
      },
      select: { id: true },
    });

    if (existing) {
      await targetPrisma.courseFAQ.update({
        where: { id: existing.id },
        data: {
          question: translatedQuestion,
          answer: translatedAnswer,
        },
      });
    } else {
      await targetPrisma.courseFAQ.create({
        data: {
          courseId: targetCourse.id,
          question: translatedQuestion,
          answer: translatedAnswer,
          order: faq.order,
        },
      });
    }
  }
  console.log(`Translated ${faqs.length} course FAQs`);
}

async function translateCohortFAQs(
  openai: OpenAI,
  sourcePrisma: PrismaClient,
  targetPrisma: PrismaClient,
) {
  const faqs = await sourcePrisma.cohortFAQ.findMany({
    include: { cohort: { select: { slug: true } } },
  });

  for (const faq of faqs) {
    const cohortSlug = faq.cohort?.slug;
    if (!cohortSlug) {
      console.warn(`Skipping cohort FAQ ${faq.id} - missing cohort slug`);
      continue;
    }

    const targetCohort = await targetPrisma.cohort.findUnique({
      where: { slug: cohortSlug },
      select: { id: true },
    });

    if (!targetCohort) {
      console.warn(`Skipping cohort FAQ ${faq.id} - no target cohort for ${cohortSlug}`);
      continue;
    }

    const translatedQuestion = await translateText(
      openai,
      faq.question,
      "cohort FAQ question",
    );
    const translatedAnswer = await translateText(
      openai,
      faq.answer,
      "cohort FAQ answer",
    );

    const existing = await targetPrisma.cohortFAQ.findFirst({
      where: {
        cohortId: targetCohort.id,
        order: faq.order,
      },
      select: { id: true },
    });

    if (existing) {
      await targetPrisma.cohortFAQ.update({
        where: { id: existing.id },
        data: {
          question: translatedQuestion,
          answer: translatedAnswer,
        },
      });
    } else {
      await targetPrisma.cohortFAQ.create({
        data: {
          cohortId: targetCohort.id,
          question: translatedQuestion,
          answer: translatedAnswer,
          order: faq.order,
        },
      });
    }
  }
  console.log(`Translated ${faqs.length} cohort FAQs`);
}

async function translateBlogArticles(
  openai: OpenAI,
  sourcePrisma: PrismaClient,
  targetPrisma: PrismaClient,
) {
  const articles = await sourcePrisma.blogArticle.findMany();

  for (const article of articles) {
    const translatedTitle = await translateText(
      openai,
      article.title,
      "blog article title",
    );
    const translatedContent = article.content
      ? await translateText(openai, article.content, "blog article content")
      : null;
    const translatedExcerpt = article.excerpt
      ? await translateText(openai, article.excerpt, "blog article excerpt")
      : null;
    const translatedMeta = article.metaDescription
      ? await translateText(
          openai,
          article.metaDescription,
          "blog article meta description",
        )
      : null;

    const internalLinksMetadata = article.internalLinksMetadata ?? undefined;
    const tokensUsed = article.tokensUsed ?? undefined;

    await targetPrisma.blogArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: translatedTitle,
        content: translatedContent,
        excerpt: translatedExcerpt,
        metaDescription: translatedMeta,
      },
      create: {
        slug: article.slug,
        title: translatedTitle,
        h1: article.h1,
        content: translatedContent,
        excerpt: translatedExcerpt,
        metaDescription: translatedMeta,
        course: article.course,
        sourceModule: article.sourceModule,
        targetKeyword: article.targetKeyword,
        secondaryKeywords: article.secondaryKeywords,
        tags: article.tags,
        category: article.category,
        wordCount: article.wordCount,
        targetMarket: article.targetMarket,
        status: article.status,
        validationScore: article.validationScore,
        validationFeedback: article.validationFeedback,
        published: article.published,
        isIndexable: article.isIndexable,
        publishedAt: article.publishedAt,
        internalLinksMetadata,
        tokensUsed,
        generationCost: article.generationCost,
      },
    });
  }
  console.log(`Translated ${articles.length} blog articles`);
}

async function main() {
  loadEnv();

  const apiKey = getEnvValue("OPENAI_API_KEY");
  const sourceUrl = process.env.SOURCE_DATABASE_URL ?? getEnvValue("DATABASE_URL");
  const targetUrl =
    process.env.TARGET_DATABASE_URL ?? getEnvValue("DIRECT_URL");

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target database URLs are identical.");
  }

  const openai = new OpenAI({ apiKey });
  const sourcePrisma = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });
  const targetPrisma = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    console.log("Starting database translation...");
    await translateCourseCategories(openai, sourcePrisma, targetPrisma);
    await translateCourseFAQs(openai, sourcePrisma, targetPrisma);
    await translateCohortFAQs(openai, sourcePrisma, targetPrisma);
    await translateBlogArticles(openai, sourcePrisma, targetPrisma);
    console.log("Database translation complete.");
  } finally {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Database translation failed:", error);
  process.exit(1);
});
