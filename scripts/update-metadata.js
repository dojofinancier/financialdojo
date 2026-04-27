
const fs = require("fs");
const path = require("path");

const basePath = path.join("c:", "Users", "User", "Desktop", "financial_dojo", "app");

// 1. app/layout.tsx
const layoutTsxPath = path.join(basePath, "layout.tsx");
let layoutTsx = fs.readFileSync(layoutTsxPath, "utf8");
const oldLayoutMeta = `export const metadata: Metadata = {
  title: "Finance Dojo",
  description: "Financial Education Platform",
  icons: {
    icon: "/fav-fd.ico",
    shortcut: "/fav-fd.ico",
    apple: "/fav-fd.ico",
  },
};`;
const newLayoutMeta = `export const metadata: Metadata = {
  metadataBase: new URL("https://financedojo.ca"),
  title: {
    default: "Financial Dojo - Master Your Finance Exams (CIRE, RSE)",
    template: "%s | Financial Dojo",
  },
  description: "Pass your CIRE and RSE exams with confidence. Discover world-class financial training, targeted prep courses, and expert insights for Canadian finance professionals.",
  applicationName: "Financial Dojo",
  icons: {
    icon: "/fav-fd.ico",
    shortcut: "/fav-fd.ico",
    apple: "/fav-fd.ico",
  },
  openGraph: {
    title: "Financial Dojo - Master Your Finance Exams (CIRE, RSE)",
    description: "Pass your CIRE and RSE exams with confidence. Discover world-class financial training, targeted prep courses, and expert insights for Canadian finance professionals.",
    type: "website",
    siteName: "Financial Dojo",
    locale: "en_CA",
  },
};`;
if (layoutTsx.includes(oldLayoutMeta)) {
  layoutTsx = layoutTsx.replace(oldLayoutMeta, newLayoutMeta);
  fs.writeFileSync(layoutTsxPath, layoutTsx);
}

// 2. app/page.tsx
const pageTsxPath = path.join(basePath, "page.tsx");
let pageTsx = fs.readFileSync(pageTsxPath, "utf8");
if (!pageTsx.includes("export const metadata")) {
  pageTsx = `import { Metadata } from "next";\n\nexport const metadata: Metadata = {\n  title: "Financial Dojo - Master Your Finance Exams (CIRE, RSE)",\n  description: "Join 2500+ students who passed their Canadian finance exams. Expert-led prep courses for CIRE and RSE. Start your financial career with confidence.",\n};\n\n` + pageTsx;
  fs.writeFileSync(pageTsxPath, pageTsx);
}

// 3. app/about/page.tsx
const aboutTsxPath = path.join(basePath, "about", "page.tsx");
if (fs.existsSync(aboutTsxPath)) {
  let aboutTsx = fs.readFileSync(aboutTsxPath, "utf8");
  if (!aboutTsx.includes("export const metadata")) {
    if (!aboutTsx.includes("import { Metadata }") && !aboutTsx.includes("import type { Metadata }")) {
      aboutTsx = `import type { Metadata } from "next";\n` + aboutTsx;
    }
    const aboutMeta = `\nexport const metadata: Metadata = {\n  title: "About Us",\n  description: "Learn how Financial Dojo became Canada's trusted platform for financial education. Meet our expert instructors with over 15 years of industry experience.",\n};\n\n`;
    aboutTsx = aboutTsx.replace("export default function", aboutMeta + "export default function");
    fs.writeFileSync(aboutTsxPath, aboutTsx);
  }
}

// 4. app/contact/page.tsx
const contactTsxPath = path.join(basePath, "contact", "page.tsx");
if (fs.existsSync(contactTsxPath)) {
  let contactTsx = fs.readFileSync(contactTsxPath, "utf8");
  if (!contactTsx.includes("export const metadata")) {
    if (!contactTsx.includes("import { Metadata }") && !contactTsx.includes("import type { Metadata }")) {
      contactTsx = `import type { Metadata } from "next";\n` + contactTsx;
    }
    const contactMeta = `\nexport const metadata: Metadata = {\n  title: "Contact Us",\n  description: "Have questions about our CIRE and RSE prep courses? Contact the Financial Dojo team today for personalized support and guidance on your financial career.",\n};\n\n`;
    contactTsx = contactTsx.replace("export default function", contactMeta + "export default function");
    fs.writeFileSync(contactTsxPath, contactTsx);
  }
}

// 5. app/courses/page.tsx
const coursesTsxPath = path.join(basePath, "courses", "page.tsx");
if (fs.existsSync(coursesTsxPath)) {
  let coursesTsx = fs.readFileSync(coursesTsxPath, "utf8");
  if (!coursesTsx.includes("export const metadata")) {
    if (!coursesTsx.includes("import { Metadata }") && !coursesTsx.includes("import type { Metadata }")) {
      coursesTsx = `import type { Metadata } from "next";\n` + coursesTsx;
    }
    const coursesMeta = `\nexport const metadata: Metadata = {\n  title: "Professional Finance Courses",\n  description: "Browse our premium exam preparation courses. Fast-track your success with our proven CIRE and RSE training programs designed for Canadian finance professionals.",\n};\n\n`;
    coursesTsx = coursesTsx.replace("export default async function", coursesMeta + "export default async function");
    fs.writeFileSync(coursesTsxPath, coursesTsx);
  } else {
    // Replace existing metadata if generic
    const regex = /export const metadata.*?};/s;
    const coursesMeta = `export const metadata: Metadata = {\n  title: "Professional Finance Courses",\n  description: "Browse our premium exam preparation courses. Fast-track your success with our proven CIRE and RSE training programs designed for Canadian finance professionals.",\n};`;
    coursesTsx = coursesTsx.replace(regex, coursesMeta);
    fs.writeFileSync(coursesTsxPath, coursesTsx);
  }
}

// 6. app/article/page.tsx
const articleTsxPath = path.join(basePath, "article", "page.tsx");
if (fs.existsSync(articleTsxPath)) {
  let articleTsx = fs.readFileSync(articleTsxPath, "utf8");
  const regex = /export const metadata: Metadata = \{[\s\S]*?\};/;
  const newArticleMeta = `export const metadata: Metadata = {
  title: "Finance & Investing Articles",
  description: "Stay ahead in the financial industry. Read expert articles on exam strategies, market insights, and career growth for Canadian finance professionals.",
  openGraph: {
    title: "Finance & Investing Articles | Financial Dojo",
    description: "Stay ahead in the financial industry. Read expert articles on exam strategies, market insights, and career growth for Canadian finance professionals.",
    type: "website",
  },
};`;
  articleTsx = articleTsx.replace(regex, newArticleMeta);
  fs.writeFileSync(articleTsxPath, articleTsx);
}

console.log("Metadata updated across pages.");

