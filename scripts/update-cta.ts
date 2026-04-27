
const fs = require("fs");
const path = require("path");

const blogTsPath = path.join("c:", "Users", "User", "Desktop", "financial_dojo", "app", "actions", "blog.ts");
let blogTs = fs.readFileSync(blogTsPath, "utf8");

const ctaCoursesCode = `
/**
 * Get CIRE and RSE courses for CTA
 */
export async function getCTACourses() {
  try {
    const courses = await prisma.course.findMany({
      where: {
        published: true,
        slug: { in: ["cire", "rse"] }
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
      orderBy: {
        title: "asc",
      },
    });

    return courses.map((course) => ({
      ...course,
      price: course.price.toNumber(),
    }));
  } catch (error) {
    console.error("Error fetching CTA courses:", error);
    return [];
  }
}
`;

if (!blogTs.includes("getCTACourses")) {
  blogTs = blogTs + "\n" + ctaCoursesCode;
  fs.writeFileSync(blogTsPath, blogTs);
}

const pageTsPath = path.join("c:", "Users", "User", "Desktop", "financial_dojo", "app", "article", "[slug]", "page.tsx");
let pageTs = fs.readFileSync(pageTsPath, "utf8");

pageTs = pageTs.replace(
  `import { getArticleBySlug, getRecommendedArticles, getProfessionalCourses, getInvestorCourses } from "@/app/actions/blog";`,
  `import { getArticleBySlug, getRecommendedArticles, getCTACourses } from "@/app/actions/blog";`
);

const oldCoursesLogic = `  // Get courses for CTA based on target market (case-insensitive)
  let courses = null;
  const targetMarket = article.targetMarket?.toLowerCase();
  if (targetMarket === "professionals") {
    courses = await getProfessionalCourses();
  } else if (targetMarket === "investors") {
    courses = await getInvestorCourses();
  }`;

const newCoursesLogic = `  // Get courses for CTA
  const courses = await getCTACourses();`;

pageTs = pageTs.replace(oldCoursesLogic, newCoursesLogic);
fs.writeFileSync(pageTsPath, pageTs);

const ctaTsPath = path.join("c:", "Users", "User", "Desktop", "financial_dojo", "components", "blog", "article-cta.tsx");
let ctaTs = fs.readFileSync(ctaTsPath, "utf8");

// Change grid columns from md:grid-cols-3 to md:grid-cols-2 (since there are 2 courses)
ctaTs = ctaTs.replace("grid-cols-1 md:grid-cols-3", "grid-cols-1 md:grid-cols-2");

// Change title
const oldGetCTATitle = `  const getCTATitle = () => {
    const market = targetMarket?.toLowerCase();
    switch (market) {
      case "professionals":
        return "Recommended professional courses";
      case "investors":
        return "Courses for investors";
      case "entrepreneurs":
        return "Courses for entrepreneurs";
      default:
        return "Recommended courses";
    }
  };`;
const newGetCTATitle = `  const getCTATitle = () => {
    return "Prepare for your exams with our courses";
  };`;
ctaTs = ctaTs.replace(oldGetCTATitle, newGetCTATitle);

const oldGetCTADescription = `  const getCTADescription = () => {
    const market = targetMarket?.toLowerCase();
    switch (market) {
      case "professionals":
        return "Discover our professional courses designed to develop your financial skills.";
      case "investors":
        return "Explore our courses specifically designed for investors.";
      case "entrepreneurs":
        return "Develop your financial skills with our courses for entrepreneurs.";
      default:
        return "Discover our courses to deepen your knowledge.";
    }
  };`;
const newGetCTADescription = `  const getCTADescription = () => {
    return "Ready to take the next step? Check out our dedicated exam preparation courses for CIRE and RSE.";
  };`;
ctaTs = ctaTs.replace(oldGetCTADescription, newGetCTADescription);

fs.writeFileSync(ctaTsPath, ctaTs);
console.log("Updated CTA perfectly.");

