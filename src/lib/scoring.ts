import { SCORE_DIMENSIONS } from "@/lib/agents/definitions";
import type { InvestorOutput } from "@/lib/agents/schemas";

/**
 * Skorlama kasten deterministiktir: ajanlar boyut puanlarını verir, ağırlıklı
 * ortalamayı sistem hesaplar. Böylece "genel puan" bir modelin keyfine değil,
 * yazılı bir formüle bağlıdır ve aynı girdide her zaman aynı çıkar.
 */
export function weightedOverall(scores: Array<{ dimension: string; value: number }>): number {
  let total = 0;
  let weightSum = 0;

  for (const { dimension, weight } of SCORE_DIMENSIONS) {
    const match = scores.find((s) => s.dimension === dimension);
    if (!match) continue;
    total += match.value * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return 0;
  return Math.round(total / weightSum);
}

const DECISION_VALUE: Record<InvestorOutput["decision"], number> = {
  INVEST: 100,
  FOLLOW_UP: 50,
  PASS: 0,
};

/**
 * Anlaşmazlık Endeksi (0-100).
 *
 * Üç yatırımcının kararları arasındaki standart sapmayı, üç karar için
 * ulaşılabilecek en yüksek sapmaya (iki uçta iki karar, üçüncüsü tek başına
 * — yaklaşık 47,1) bölerek normalize eder.
 *
 * 0  = üçü de aynı kararı verdi (yüksek güven)
 * 100 = kararlar mümkün olan en uçta ayrıştı (tartışmalı fikir)
 *
 * Bu metrik ürünün tezini görselleştirir: değer tek bir cevapta değil,
 * cevapların ayrıştığı yerde.
 */
export function disagreementIndex(decisions: InvestorOutput["decision"][]): number {
  if (decisions.length < 2) return 0;

  const values = decisions.map((d) => DECISION_VALUE[d]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);

  const MAX_STDEV = 47.14; // {0, 0, 100} dağılımının standart sapması
  return Math.max(0, Math.min(100, Math.round((stdev / MAX_STDEV) * 100)));
}

/** Anlaşmazlık endeksini arayüzde tek kelimeyle anlatan etiket. */
export function disagreementLabel(index: number): { label: string; tone: "consensus" | "split" | "contested" } {
  if (index < 25) return { label: "Güçlü fikir birliği", tone: "consensus" };
  if (index < 65) return { label: "Kısmi ayrışma", tone: "split" };
  return { label: "Tartışmalı fikir", tone: "contested" };
}

export function scoreTone(value: number): "strong" | "mixed" | "weak" {
  if (value >= 70) return "strong";
  if (value >= 45) return "mixed";
  return "weak";
}
