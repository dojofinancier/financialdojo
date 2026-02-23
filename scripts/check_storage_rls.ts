import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking storage buckets...");
        const buckets = await prisma.$queryRawUnsafe(`
      SELECT id, name, file_size_limit, allowed_mime_types, public 
      FROM storage.buckets;
    `);
        console.log("Buckets:", buckets);

        console.log("\nChecking storage.objects RLS policies...");
        const policies = await prisma.$queryRawUnsafe(`
      SELECT schemaname, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'objects';
    `);
        console.log("Policies:", policies);

    } catch (error) {
        console.error("Error checking storage:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
