import { GeminiProvider } from "./gemini";
import { SimulationProvider } from "./simulation";
import type { LlmProvider } from "./types";

// Sağlayıcı süreç boyunca tek örnek kalmalı: rate limiter durumu onun içinde
// tutuluyor, her çağrıda yenisi kurulursa dakika sayacı sıfırlanır. Kota kilidi
// de aynı sebeple burada: süreç genelinde tek bir doğru olmalı.
const globalForLlm = globalThis as unknown as {
  llmProvider?: LlmProvider;
  simulationProvider?: LlmProvider;
  llmUnavailableUntil?: number;
  groundingUnavailableUntil?: number;
};

/**
 * Sağlayıcı seçiminin nedeni. Arayüz bunu gösterir; "neden simülasyondayım?"
 * sorusunun cevabı ekrandan okunabilir olmalı, log'a bakmayı gerektirmemeli.
 */
export type ProviderReason =
  /** Anahtar var ve biçimi makul. */
  | "ok"
  /** GEMINI_API_KEY hiç tanımlı değil. */
  | "no-key"
  /** Anahtarın içinde boşluk var — neredeyse her zaman hatalı yapıştırma. */
  | "malformed";

export interface ProviderStatus {
  id: "gemini" | "simulation";
  reason: ProviderReason;
}

/**
 * Anahtarı okur ve ne yapılacağına karar verir.
 *
 * Kritik davranış: anahtar bozuksa sessizce simülasyona düşülmez — durum
 * ayrı bir alanda taşınır ve Ayarlar ekranında gösterilir. Bu fonksiyonun
 * kendisi yan etkisizdir, böylece arayüz de aynı kararı sorgulayabilir.
 */
export function providerStatus(): ProviderStatus {
  const raw = process.env.GEMINI_API_KEY;
  const apiKey = raw?.trim();

  if (!apiKey) return { id: "simulation", reason: "no-key" };

  // Tek güvenilir biçim kontrolü bu: anahtarın içinde boşluk olamaz.
  // Buraya düşmenin pratikte tek yolu .env satırına anahtarın yanına başka
  // bir metin yapıştırılmasıdır.
  //
  // Önek kontrolü YAPILMIYOR: Google birden fazla geçerli anahtar biçimi
  // dağıtıyor (`AIza…` ve `AQ.…` gibi) ve önek listesi tutmak, çalışan bir
  // anahtarı yanlışlıkla şüpheli göstermekten başka işe yaramıyor.
  if (/\s/.test(apiKey)) return { id: "simulation", reason: "malformed" };

  return { id: "gemini", reason: "ok" };
}

/**
 * Anahtar varsa Gemini, yoksa simülasyon.
 *
 * Simülasyon bir "fallback" değil bilinçli bir ürün kararı: sistem anahtarsız
 * da uçtan uca çalışır, böylece sunumda kota bitse bile demo ayakta kalır.
 * Hangi sağlayıcının çalıştığı analiz kaydına yazılır ve arayüzde gösterilir.
 */
export function getLlmProvider(): LlmProvider {
  if (globalForLlm.llmProvider) return globalForLlm.llmProvider;

  const status = providerStatus();
  const rpm = Number(process.env.GEMINI_RPM_LIMIT ?? "10") || 10;

  if (status.reason === "malformed") {
    console.warn(
      "[llm] GEMINI_API_KEY boşluk içeriyor — .env satırına anahtarın yanına " +
        "fazladan metin yapıştırılmış olabilir. Simülasyon sağlayıcısına düşülüyor.",
    );
  }
  const provider: LlmProvider =
    status.id === "gemini"
      ? new GeminiProvider(process.env.GEMINI_API_KEY!.trim(), rpm)
      : new SimulationProvider();

  globalForLlm.llmProvider = provider;
  return provider;
}

/**
 * Gerçek sağlayıcı çalışmadığında devreye giren yedek.
 *
 * `getLlmProvider()` anahtar yokken zaten simülasyon döndürür; bu ayrı tekil
 * yalnızca düşme (degrade) yolunda, yani anahtar VAR ama kota bittiğinde
 * kullanılır. Ayrı tutuluyor ki "aktif sağlayıcı" kavramı bulanmasın.
 */
export function getSimulationProvider(): LlmProvider {
  globalForLlm.simulationProvider ??= new SimulationProvider();
  return globalForLlm.simulationProvider;
}

/** Kota kilidinin ne kadar süreyle açık kalacağı. */
export const LLM_COOLDOWN_MS = 10 * 60_000;

/**
 * Kota kilidi.
 *
 * Gemini'nin günlük/plan kotası bittiğinde her ajan için ayrı ayrı 429 yemenin
 * anlamı yok: on bir ajanın hepsi aynı duvara çarpar, üstüne RPM sınırlayıcısı
 * bu boş denemeleri de sayarak analizi dakikalarca uzatır. İlk tükenmede süreç
 * genelinde bayrak kaldırılır ve kalan ajanlar doğrudan simülasyona gider.
 *
 * Bayrak süreli: kota geri geldiğinde sunucuyu yeniden başlatmak gerekmesin.
 */
export function markLlmUnavailable(cooldownMs = LLM_COOLDOWN_MS): void {
  globalForLlm.llmUnavailableUntil = Date.now() + cooldownMs;
}

export function isLlmUnavailable(): boolean {
  return (globalForLlm.llmUnavailableUntil ?? 0) > Date.now();
}

/** Kilidin ne zaman düşeceği. Ayarlar ekranı bunu gösterir. */
export function llmUnavailableUntil(): Date | null {
  const until = globalForLlm.llmUnavailableUntil ?? 0;
  return until > Date.now() ? new Date(until) : null;
}

/** Kilidi elle kaldırır — testler ve "tekrar dene" için. */
export function clearLlmUnavailable(): void {
  delete globalForLlm.llmUnavailableUntil;
}

/**
 * Google Search kotasının ayrı kilidi.
 *
 * Grounding'in modelden BAĞIMSIZ bir kotası var ve ücretsiz katmanda çoğu
 * hesapta sıfır: model çağrısı 200 dönerken aynı anahtarla `googleSearch`
 * aracı 429 döner. Bu kilit olmadan her analizde grounded ajanların hepsi
 * önce bir arama çağrısı yakıp sonra aramasız tekrar denerdi — hem RPM
 * bütçesini hem süreyi boşa harcayarak.
 *
 * Model kotasından daha uzun bekliyoruz: arama kotası çoğu zaman plan
 * seviyesinde kapalıdır, dakikalık bir dalgalanma değildir.
 */
export const GROUNDING_COOLDOWN_MS = 60 * 60_000;

export function markGroundingUnavailable(cooldownMs = GROUNDING_COOLDOWN_MS): void {
  globalForLlm.groundingUnavailableUntil = Date.now() + cooldownMs;
}

export function isGroundingUnavailable(): boolean {
  return (globalForLlm.groundingUnavailableUntil ?? 0) > Date.now();
}

export function clearGroundingUnavailable(): void {
  delete globalForLlm.groundingUnavailableUntil;
}

export type { LlmProvider, LlmRequest, LlmResult } from "./types";
export { RetryableLlmError } from "./types";
