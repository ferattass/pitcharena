/**
 * İstemciye de gidebilen sabitler ve etiketler.
 *
 * `analysis.ts` içindeki yardımcılar Prisma ve node:crypto'ya dokunuyor;
 * arayüzün ihtiyaç duyduğu bu küçük parçalar ayrı durmalı ki tarayıcı
 * paketine sunucu kodu sızmasın.
 */

export const MIN_IDEA_LENGTH = 40;
export const MAX_IDEA_LENGTH = 2000;

export function verdictLabel(verdict: string | null | undefined): string {
  switch (verdict) {
    case "GO":
      return "GO";
    case "GO_IF":
      return "GO-IF";
    case "NO_GO":
      return "NO-GO";
    default:
      return "—";
  }
}

export function verdictHeadline(verdict: string | null | undefined): string {
  switch (verdict) {
    case "GO":
      return "Komite yatırım yönünde";
    case "GO_IF":
      return "Koşullu ilerleme";
    case "NO_GO":
      return "Bu aşamada yatırım yok";
    default:
      return "Karar bekleniyor";
  }
}

export function verdictVariant(verdict: string | null | undefined): "go" | "goif" | "nogo" | "neutral" {
  switch (verdict) {
    case "GO":
      return "go";
    case "GO_IF":
      return "goif";
    case "NO_GO":
      return "nogo";
    default:
      return "neutral";
  }
}

export function decisionLabel(decision: string): string {
  switch (decision) {
    case "INVEST":
      return "Yatırım yapar";
    case "FOLLOW_UP":
      return "Takibe alır";
    case "PASS":
      return "Geçer";
    default:
      return decision;
  }
}

export function severityLabel(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "Kritik";
    case "HIGH":
      return "Yüksek";
    case "MEDIUM":
      return "Orta";
    case "LOW":
      return "Düşük";
    default:
      return severity;
  }
}

export function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "HIGH":
      return "Yüksek güven";
    case "MEDIUM":
      return "Orta güven";
    case "LOW":
      return "Düşük güven";
    default:
      return confidence;
  }
}

export function strategyLabel(strategy: string): string {
  switch (strategy) {
    case "EVIDENCE":
      return "Karşı kanıt";
    case "PIVOT":
      return "Pivot";
    case "CONCEDE":
      return "Kabul";
    default:
      return strategy;
  }
}
