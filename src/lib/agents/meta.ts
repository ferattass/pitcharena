/**
 * Ajanların istemciye açık meta verisi.
 *
 * `definitions.ts` sistem promptlarını taşır ve sunucuda kalır; arayüzün
 * ihtiyacı olan ad/teşvik/renk bilgisi burada durur ki promptlar tarayıcıya
 * gönderilmesin.
 */

export const AGENT_KEYS = [
  "market",
  "competitor",
  "feasibility",
  "business",
  "risk",
  "skeptic",
  "advocate",
  "angel",
  "seriesA",
  "corporate",
  "chair",
] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

export type AgentAccent = "neutral" | "attack" | "defense" | "investor" | "chair";

// Ücretsiz katmanı korumak için ağır muhakeme yalnızca tek sentez çağrısında.
//
// Model kimlikleri Google tarafında hızla eskiyor: `gemini-2.5-flash` hâlâ
// listeleniyor ama yeni hesaplara kapalı ("no longer available to new users").
// Bu yüzden her rol için bir yedek zinciri tutuyoruz; biri kapanırsa ya da
// kotası biterse orkestratör sıradakine geçer (bkz. lib/orchestrator/run.ts).
export const FLASH_MODEL = "gemini-3.5-flash-lite";
export const PRO_MODEL = FLASH_MODEL;

/** Birincil model çağrılamazsa sırayla denenecek modeller. */
export const FLASH_FALLBACKS: string[] = ["gemini-3.5-flash", "gemini-3.6-flash"];

// Ücretsiz katmanda Pro kotası çoğu hesapta yok; sentez o durumda Flash'a
// düşer. Analiz üretmemektense biraz daha zayıf muhakemeyle üretmek yeğdir.
export const PRO_FALLBACKS: string[] = ["gemini-3.5-flash", "gemini-3.6-flash"];

export interface AgentMeta {
  key: AgentKey;
  name: string;
  /** Ajanın tek cümlelik teşviki — kartın altında gösterilir. */
  incentive: string;
  round: 1 | 2 | 3 | 4;
  accent: AgentAccent;
  /** Birincil model. Arayüzde gösterilen değer budur. */
  model: string;
  /** Birincil model çağrılamazsa sırayla denenecek modeller. */
  fallbackModels: string[];
  /** Google Search grounding kullanan ajanlar arayüzde kaynak rozetiyle işaretlenir. */
  grounded: boolean;
}

export const AGENT_META: Record<AgentKey, AgentMeta> = {
  market: { key: "market", name: "Pazar Analisti", incentive: "Sayı bulmak", round: 1, accent: "neutral", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: true },
  competitor: { key: "competitor", name: "Rakip Avcısı", incentive: "«Bu zaten var» demek", round: 1, accent: "neutral", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: true },
  feasibility: { key: "feasibility", name: "Teknik Fizibilite", incentive: "Zorluğu ölçmek", round: 1, accent: "neutral", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  business: { key: "business", name: "İş Modeli & Birim Ekonomi", incentive: "«Para nereden geliyor?»", round: 1, accent: "neutral", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  risk: { key: "risk", name: "Risk & Regülasyon", incentive: "Tehlike bulmak", round: 1, accent: "neutral", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  skeptic: { key: "skeptic", name: "Şüpheci Yatırımcı", incentive: "Fikri öldürmek", round: 2, accent: "attack", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  advocate: { key: "advocate", name: "Kurucu Avukatı", incentive: "Fikri savunmak", round: 2, accent: "defense", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  angel: { key: "angel", name: "Melek Yatırımcı", incentive: "Ekip ve zamanlama > metrik", round: 3, accent: "investor", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  seriesA: { key: "seriesA", name: "Seri A Yatırımcısı", incentive: "Traction ve pazar büyüklüğü", round: 3, accent: "investor", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  corporate: { key: "corporate", name: "Kurumsal Yatırımcı (CVC)", incentive: "Stratejik uyum ve entegrasyon", round: 3, accent: "investor", model: FLASH_MODEL, fallbackModels: FLASH_FALLBACKS, grounded: false },
  chair: { key: "chair", name: "Yatırım Komitesi Başkanı", incentive: "Anlaşmazlığı tutanağa geçirmek", round: 4, accent: "chair", model: PRO_MODEL, fallbackModels: PRO_FALLBACKS, grounded: false },
};

export const ROUND_AGENTS: Record<1 | 2 | 3 | 4, AgentKey[]> = {
  1: ["market", "competitor", "feasibility", "business", "risk"],
  2: ["skeptic", "advocate"],
  3: ["angel", "seriesA", "corporate"],
  4: ["chair"],
};

export const ROUND_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Bağımsız Analiz",
  2: "Çapraz Sorgu",
  3: "Yatırımcı Simülasyonu",
  4: "Sentez",
};

export const ROUND_SUBTITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "Beş ajan paralel çalışır ve birbirini görmez — körlük kasıtlıdır.",
  2: "Ajanlar Tur 1'in tamamını görür. Biri fikri öldürmeye, diğeri savunmaya çalışır.",
  3: "Aynı fikre üç farklı yatırım teziyle bakılır. Ayrışmaları normaldir.",
  4: "Komite karar verir ve muhalefeti tutanağa geçirir.",
};

export const INVESTOR_KEYS: AgentKey[] = ["angel", "seriesA", "corporate"];

/** Skor boyutları: hangi Tur 1 ajanı hangi boyutu hangi ağırlıkla besliyor. */
export const SCORE_DIMENSIONS = [
  { key: "market", dimension: "Pazar Fırsatı", weight: 0.25 },
  { key: "competitor", dimension: "Rekabet Avantajı", weight: 0.2 },
  { key: "feasibility", dimension: "Teknik Yapılabilirlik", weight: 0.2 },
  { key: "business", dimension: "İş Modeli", weight: 0.2 },
  { key: "risk", dimension: "Risk Profili", weight: 0.15 },
] as const satisfies ReadonlyArray<{ key: AgentKey; dimension: string; weight: number }>;

export const TOTAL_AGENTS = AGENT_KEYS.length;
