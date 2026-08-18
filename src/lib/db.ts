import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 bağlantı URL'ini şemadan değil sürücü adaptöründen alır.
const connectionString = process.env.DATABASE_URL;

function createClient() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL tanımlı değil. .env.example dosyasını .env olarak kopyalayın.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Dev'de hot reload her modül yeniden yüklendiğinde yeni havuz açmasın.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
