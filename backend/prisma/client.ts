import { PrismaClient } from "../generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"

// Reuse a single PrismaClient instance across the app. In dev with hot-reload
// this avoids exhausting the database connection pool by creating a new client
// on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Prisma 7 uses driver adapters instead of a bundled query engine.
// PG_POOL_MAX caps the pool — useful when the database enforces a low
// connection limit (small hosted tiers, pgbouncer, local test harnesses).
const poolMax = Number(process.env["PG_POOL_MAX"])
const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
  ...(Number.isFinite(poolMax) && poolMax > 0 && { max: poolMax }),
})

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma
}
