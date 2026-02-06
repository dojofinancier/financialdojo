import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca";

    // Fetch all articles
    const articles = await prisma.blogArticle.findMany({
        where: {
            published: true,
            isIndexable: true,
        },
        select: {
            slug: true,
            updatedAt: true,
        },
    });

    // Fetch all courses
    const courses = await prisma.course.findMany({
        where: {
            published: true,
            slug: { not: null },
        },
        select: {
            slug: true,
            updatedAt: true,
        },
    });

    const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
        url: `${siteUrl}/article/${article.slug}`,
        lastModified: article.updatedAt || new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
    }));

    const courseEntries: MetadataRoute.Sitemap = courses.map((course) => ({
        url: `${siteUrl}/courses/${course.slug}`,
        lastModified: course.updatedAt || new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
    }));

    const formationEntries: MetadataRoute.Sitemap = courses.map((course) => ({
        url: `${siteUrl}/formations/${course.slug}`,
        lastModified: course.updatedAt || new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
    }));

    const staticRoutes: MetadataRoute.Sitemap = [
        "",
        "/about",
        "/contact",
        "/courses",
        "/article",
        "/privacy-policy",
        "/terms-and-conditions",
        "/a-propos",
        "/formations",
        "/politique-de-confidentialite",
        "/termes-et-conditions",
        "/investor",
        "/investisseur",
        "/learn",
        "/apprendre",
    ].map((route) => ({
        url: `${siteUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: route === "" ? 1.0 : 0.8,
    }));

    return [...staticRoutes, ...courseEntries, ...formationEntries, ...articleEntries];
}
