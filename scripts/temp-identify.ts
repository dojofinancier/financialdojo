import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const user = await prisma.user.findFirst();
    const course = await prisma.course.findFirst();
    console.log(`USER:${user?.email}`);
    console.log(`COURSE:${course?.slug || course?.code || course?.id}`);
}
run();
