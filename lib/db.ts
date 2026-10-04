import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Reuse a single client per process in every environment. On serverless
// (Vercel) this keeps a warm instance across invocations and avoids opening a
// fresh Postgres connection on every request; in development it survives Fast
// Refresh. Always point DATABASE_URL at a pooled endpoint in production.
globalForPrisma.prisma = prisma;
