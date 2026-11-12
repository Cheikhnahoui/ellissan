import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set in this environment");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
}

/** Created lazily so a missing variable fails with a clear message at first use, not at import time. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    globalForPrisma.prisma ??= create();
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});
