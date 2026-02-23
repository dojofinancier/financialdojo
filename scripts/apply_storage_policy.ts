import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL
        }
    }
});

async function main() {
    try {
        console.log("Checking pg_policy directly...");
        const policies = await prisma.$queryRawUnsafe(`
          SELECT polname, polroles, polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck 
          FROM pg_policy 
          WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'objects' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage'));
        `);
        console.log("pg_policy:", policies);

    } catch (error) {
        console.error("Error checking pg_policy:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
