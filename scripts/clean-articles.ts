import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.blogArticle.findMany();
  let updatedCount = 0;
  
  for (const article of articles) {
    if (!article.content) continue;
    
    let newContent = article.content;
    
    // Replace Hook
    newContent = newContent.replace(/(?:\*\*|__)?Hook:(?:\*\*|__)?\s*/gi, "");
    
    // Replace copied from the source
    newContent = newContent.replace(/\s*\([\s]*copied from the source[\s]*\)/gi, "");
    newContent = newContent.replace(/\s*copied from the source:?/gi, "");
    
    if (newContent !== article.content) {
      await prisma.blogArticle.update({
        where: { id: article.id },
        data: { content: newContent }
      });
      
      updatedCount++;
    }
  }
  
  console.log(`\nSuccessfully updated ${updatedCount} articles in the database.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
