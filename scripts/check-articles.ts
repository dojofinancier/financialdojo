import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const article = await prisma.blogArticle.findFirst({
    where: { title: { contains: "FSRA and the Other Players" } }
  });
  console.log(article?.content?.substring(0, 500));
}
main().catch(console.error).finally(() => prisma.$disconnect());
