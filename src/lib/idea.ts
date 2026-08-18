import { createHash } from "node:crypto";

/**
 * Fikir metni üzerindeki saf dönüşümler. Veritabanına dokunmadıkları için
 * `analysis.ts`ten ayrı duruyorlar — böylece test edilebilir ve DB bağlantısı
 * kurmadan içe aktarılabilirler.
 */

/**
 * Aynı fikrin tekrar tekrar analiz edilip kotayı yakmasını engellemek için
 * normalize edilmiş hash. Büyük/küçük harf ve boşluk farkları elenir.
 */
export function hashIdea(ideaText: string): string {
  const normalized = ideaText.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * Fikirden okunabilir bir başlık türetir. LLM çağrısı harcamaya değmez —
 * ilk cümle neredeyse her zaman iyi bir başlıktır.
 */
export function deriveTitle(ideaText: string): string {
  const firstSentence = ideaText.trim().split(/(?<=[.!?])\s/)[0] ?? ideaText;
  const clean = firstSentence.replace(/\s+/g, " ").trim();
  if (clean.length <= 72) return clean;
  return `${clean.slice(0, 69).trimEnd()}…`;
}
