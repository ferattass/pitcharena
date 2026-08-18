import { defineConfig, env } from "prisma/config";

// Prisma 7 CLI artık .env dosyasını kendiliğinden okumuyor — açıkça yüklüyoruz.
// Node 20.6+ yerleşik loadEnvFile'ı var, ek bağımlılık gerekmiyor.
try {
  process.loadEnvFile(".env");
} catch {
  // .env yoksa ortam değişkenleri zaten dışarıdan verilmiş demektir (CI/Azure).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
