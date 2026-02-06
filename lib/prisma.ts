import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Debug log for production connection issues
if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
  const url = process.env.DATABASE_URL;
  if (url) {
    const protocol = url.split(":")[0];
    console.log(`[Prisma Debug] Initializing with protocol: ${protocol}`);
    if (url.includes("pgbouncer")) console.log("[Prisma Debug] pgbouncer param detected");
  } else {
    console.error("[Prisma Debug] DATABASE_URL is undefined");
  }
}

