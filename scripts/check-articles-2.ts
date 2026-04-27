import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const article = await prisma.blogArticle.findFirst({
    where: { title: { contains: "LinkedIn for Canadian Finance" } }
  });
  if (article && article.content) {
    const match = article.content.match(/\[(?:insert|add|replace).*?\]/i);
    console.log(match ? match[0] : "not found");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
