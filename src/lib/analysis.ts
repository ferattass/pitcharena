import { prisma } from "@/lib/db";
import { readDb } from "@/lib/db-errors";

// Sabitler, etiketler ve saf metin dönüşümleri ayrı modüllerde durur:
// ilki istemciyle, ikincisi testlerle paylaşıldığı için DB'ye bağlı olmamalı.
export { MAX_IDEA_LENGTH, MIN_IDEA_LENGTH, decisionLabel, verdictLabel } from "@/lib/constants";
export { deriveTitle, hashIdea } from "@/lib/idea";

export function dailyLimit(): number {
  return Number(process.env.DAILY_ANALYSIS_LIMIT ?? "20") || 20;
}

/** Bugün kaç analiz başlatıldı / kaç hak kaldı. Sidebar'daki kota kutusu bunu okur. */
export async function quotaStatus() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const limit = dailyLimit();
  const { value: used } = await readDb(
    prisma.analysis.count({
      where: { createdAt: { gte: startOfDay }, isDemo: false },
    }),
    0,
  );

  return { used, limit, remaining: Math.max(0, limit - used) };
}
