import { GeminiProvider } from "./gemini";
import { SimulationProvider } from "./simulation";
import type { LlmProvider } from "./types";

// Sağlayıcı süreç boyunca tek örnek kalmalı: rate limiter durumu onun içinde
// tutuluyor, her çağrıda yenisi kurulursa dakika sayacı sıfırlanır.
const globalForLlm = globalThis as unknown as { llmProvider?: LlmProvider };

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

export type { LlmProvider, LlmRequest, LlmResult } from "./types";
export { RetryableLlmError } from "./types";
