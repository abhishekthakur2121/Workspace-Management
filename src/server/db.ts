import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Pooled connection over Neon's serverless driver (WebSocket), which supports
// transactions. Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  // Generous limits for any interactive transaction: each statement is a
  // network round trip, which is slow from a laptop far from the database.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 15_000 } });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
