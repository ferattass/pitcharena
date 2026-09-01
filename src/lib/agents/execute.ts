import { AGENTS, type AgentContext, type AgentKey } from "./definitions";
import { toGeminiSchema } from "./schemas";
import {
  getLlmProvider,
  getSimulationProvider,
  isGroundingUnavailable,
  isLlmUnavailable,
  markGroundingUnavailable,
  markLlmUnavailable,
} from "@/lib/llm";
import { ModelUnavailableError, RetryableLlmError, type LlmCitation } from "@/lib/llm/types";

/** Yeniden denenebilir hatalarda bir ajanın toplam deneme hakkı. */
export const MAX_ATTEMPTS = 3;

/** Simülasyonla üretilmiş çalıştırmaların kayda yazılan "model" adı. */
export const SIMULATION_MODEL = "simulation";

export const GROUNDING_DEGRADED_MESSAGE =
  "Google Search kotası yok; bu ajan kaynaklandırma olmadan çalışıyor.";

/**
 * Aramaya güvenerek yazılmış bir ajan aramasız çalıştığında prompt'a eklenir.
 *
 * Bunu söylemezsek model aramanın kapandığını bilmez: sistem prompt'ları
 * "web araması yapabiliyorsan gerçek veriye dayan" diyor ve model kendini
 * aramış sayarak uydurma şirket adları ve kesin görünen pazar rakamları
 * üretir. Gözlenen davranış tam olarak buydu — var olmayan rakip isimleri ve
 * dayanaksız TAM sayıları. Belirsizliği gizlemek yerine göstermesini istiyoruz.
 */
const NO_DATA_NOTICE = `

DOĞRULANMIŞ VERİ YOK — UYDURMA YASAK
Bu çalıştırmada elinde doğrulanmış hiçbir dış veri yok: arama kapalı ve Data Room boş. Aşağıdakiler kural, tavsiye değil:

1. DÜNYAYA DAİR OLGU İDDİASI YAZMA. "Türkiye'de 45 bin küçük büro var", "pazar yıllık %18 büyüyor" gibi cümleler doğrulanmış veri gerektirir; sende yok. Böyle bir sayıya ihtiyacın varsa başına "VARSAYIM:" koy ve nereden türettiğini yaz.
2. Önerdiğin her fiyat, CAC, LTV, efor ve churn rakamı bir VARSAYIMDIR. "Dayanak:" yazarken dayanağın kendisinin de tahmin olduğunu belirt — tahmini tahminle desteklemek doğrulama değildir.
3. Şirket, ürün, rapor veya mevzuat adı UYDURMA. Varlığından emin olmadığın bir oyuncuyu adıyla yazma; kategoriyi tarif et (örn. "büyük bürolara odaklanmış dava yönetim yazılımları").
   "… gibi A, B, C" biçiminde ÖRNEK MARKA LİSTESİ de verme: bu, uydurmayı bir kategorinin içine saklamaktan başka bir şey değildir. Yalnızca varlığından kesin emin olduğun, yaygın bilinen bir adı yazabilirsin; şüphe varsa adı tamamen çıkar.
4. url alanlarını BOŞ bırak. Uydurulmuş link en kötü çıktıdır.
5. confidence alanında HIGH kullanma; elinde doğrulanmış veri yok.`;

/** Kaynaklanması beklenen ajana ek: sayı alanlarında "veri yok" demek serbest. */
const NO_SEARCH_EXTRA = `
6. ARAMA KAPALI olduğu için pazar büyüklüğü gibi alanlarda uydurma rakam yerine "Veri yok — doğrulanamıyor" yazman beklenir. Uydurulmuş kesin bir rakam, "veri yok" demekten DAHA KÖTÜ bir çıktıdır.`;

/** Data Room doluysa ajanı önce oraya bakmaya zorlar. */
const EVIDENCE_NOTICE = `

DATA ROOM ÖNCELİKLİ
Yukarıdaki DATA ROOM bölümü kurucunun sunduğu doğrulanabilir kanıttır. Sayısal iddialarını önce oradan çıkar ve hangi kanıt başlığına dayandığını yaz. Data Room'un kapsamadığı bir sayı için tahmin yürütüyorsan bunu "VARSAYIM:" önekiyle işaretle.`;
export const PROVIDER_DEGRADED_MESSAGE =
  "Gemini kotası tükendi; bu ajan simülasyon sağlayıcısıyla üretildi.";

export type DegradeReason = "grounding-quota" | "provider-quota";

export interface AgentExecutionHooks {
  /** Yeniden denemeden ÖNCE çağrılır — bekleme süresini arayüze duyurmak için. */
  onRetry?(info: { attempt: number; waitMs: number; error: Error }): void | Promise<void>;
  /** Ajan planlanandan düşük yetenekle çalışacak. */
  onDegraded?(info: { reason: DegradeReason; message: string }): void | Promise<void>;
}

export interface AgentExecution {
  /** Şeması doğrulanmış çıktı. */
  parsed: unknown;
  /** Gerçekten kullanılan model — yedeğe ya da simülasyona düşülmüş olabilir. */
  model: string;
  /** Bu ajan simülasyonla mı üretildi? Analiz kaydı bunu rozetler. */
  simulated: boolean;
  citations: LlmCitation[];
  promptTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

/**
 * Tek bir ajanı çalıştırır ve çıktısını doğrular.
 *
 * Basamaklar, en yeteneklisinden en ucuzuna:
 *   1. Birincil model
 *   2. Ajanın yedek modelleri          — model kapanmış (404) ya da kotasız (429)
 *   3. Aynı zincir, grounding kapalı   — Google Search'ün ayrı ve daha dar kotası var
 *   4. Simülasyon sağlayıcısı          — gerçek sağlayıcı tamamen tükendi
 *
 * Dördüncü basamak ürünün taşıyıcı kolonu: kota bittiğinde analiz düşmez,
 * `simulated` işaretiyle üretilir ve arayüz bunu açıkça rozetler. Dürüstçe
 * etiketlenmiş bir sonuç, sunumun ortasında 500 görmekten yeğdir.
 *
 * Şema ihlali yeniden denenmez ve simülasyona düşmez: model cevap veriyor ama
 * sözleşmeyi bozuyorsa bu bir sağlayıcı arızası değil, kod tarafında görülmesi
 * gereken bir hatadır — sessizce simülasyonla örtmek onu gizler.
 */
export async function executeAgent(
  key: AgentKey,
  ctx: AgentContext,
  hooks: AgentExecutionHooks = {},
): Promise<AgentExecution> {
  const agent = AGENTS[key];
  const provider = getLlmProvider();
  const began = Date.now();

  // Anahtar yoksa aktif sağlayıcı zaten simülasyon; düşülecek basamak yok.
  if (provider.id === "simulation") return runSimulated(key, ctx, began);

  // Kota bu süreçte zaten tükenmişse tekrar denemek analizi yavaşlatmaktan
  // başka işe yaramaz (bkz. lib/llm/index.ts — kota kilidi).
  if (isLlmUnavailable()) {
    await hooks.onDegraded?.({ reason: "provider-quota", message: PROVIDER_DEGRADED_MESSAGE });
    return runSimulated(key, ctx, began);
  }

  const models = [agent.model, ...agent.fallbackModels];
  let modelIndex = 0;

  // Arama kotasının bu süreçte tükendiği biliniyorsa hiç denemeden aramasız
  // başla: her grounded ajanın önce bir 429 yakması RPM bütçesini boşa harcar.
  let grounded = agent.grounded && !isGroundingUnavailable();
  if (agent.grounded && !grounded) {
    await hooks.onDegraded?.({ reason: "grounding-quota", message: GROUNDING_DEGRADED_MESSAGE });
  }
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = models[modelIndex];
    try {
      const result = await provider.complete({
        model,
        systemPrompt: agent.systemPrompt,
        userPrompt: buildUserPrompt(key, ctx, grounded),
        jsonSchema: toGeminiSchema(agent.schema),
        grounded,
        agentKey: key,
        context: ctx,
      });

      // Şema doğrulaması: model sözleşmeyi bozduysa bu ajan başarısızdır.
      const parsed = agent.schema.parse(result.json);

      // Doğrulanmış hiçbir şeye dayanmayan ajan "yüksek güven" diyemez.
      // Kaynak getirmesi beklenen ajan için tavan daha da düşük: onun işi
      // zaten olguyu getirmekti ve getiremedi.
      const unverified = !result.citations.length && !ctx.hasEvidence;

      return {
        parsed: unverified ? capConfidence(parsed, agent.grounded ? "LOW" : "MEDIUM") : parsed,
        model,
        simulated: false,
        citations: result.citations,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        latencyMs: Date.now() - began,
      };
    } catch (error) {
      lastError = error;

      // Model kapalı ya da kotasız: aynı modeli tekrar denemek anlamsız.
      // Bu geçişler MAX_ATTEMPTS hakkından sayılmaz.
      if (error instanceof ModelUnavailableError) {
        if (modelIndex < models.length - 1) {
          modelIndex++;
          attempt--;
          continue;
        }
        if (grounded) {
          // Arama kotası ajana özel değil hesaba ait: bir kez öğrenip
          // kalan ajanlarda doğrudan aramasız başlıyoruz.
          markGroundingUnavailable();
          grounded = false;
          modelIndex = 0;
          attempt--;
          await hooks.onDegraded?.({
            reason: "grounding-quota",
            message: GROUNDING_DEGRADED_MESSAGE,
          });
          continue;
        }
        break;
      }

      if (!(error instanceof RetryableLlmError) || attempt === MAX_ATTEMPTS) break;

      // Üstel geri çekilme — ücretsiz katmanda 429 beklenen bir durumdur.
      const waitMs = error.retryAfterMs ?? 1000 * 2 ** attempt;
      await hooks.onRetry?.({ attempt, waitMs, error });
      await delay(waitMs);
    }
  }

  // Gerçek sağlayıcının bütün basamakları tükendi. Kota/model sorunu bir
  // sonraki ajanda da aynen çıkacağı için kilidi kaldırıyoruz; geçici bir
  // arızada (5xx, ağ) kilit yok, yalnızca bu ajan simülasyonla üretilir.
  if (lastError instanceof ModelUnavailableError) {
    markLlmUnavailable();
    console.warn(`[llm] ${lastError.message} — analiz simülasyon sağlayıcısıyla sürdürülüyor.`);
    await hooks.onDegraded?.({ reason: "provider-quota", message: PROVIDER_DEGRADED_MESSAGE });
    return runSimulated(key, ctx, began);
  }

  if (lastError instanceof RetryableLlmError) {
    console.warn(`[llm] ${lastError.message} — bu ajan simülasyona düşüyor.`);
    await hooks.onDegraded?.({ reason: "provider-quota", message: PROVIDER_DEGRADED_MESSAGE });
    return runSimulated(key, ctx, began);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Ajanın kullanıcı prompt'u. Aramaya güvenen bir ajan aramasız çalışıyorsa
 * bunu prompt'ta açıkça söyler — bkz. NO_SEARCH_NOTICE.
 */
function buildUserPrompt(key: AgentKey, ctx: AgentContext, grounded: boolean): string {
  const agent = AGENTS[key];
  let prompt = agent.buildUserPrompt(ctx);

  if (ctx.hasEvidence) {
    prompt += EVIDENCE_NOTICE;
    return prompt;
  }

  // Kural yalnızca kaynaklanması beklenen ajanlara uygulanınca İş Modeli gibi
  // "muhakeme" ajanları kapsam dışı kalıyor ve raporun en kesin görünen
  // sayıları oradan geliyordu ("Türkiye'de 45 bin büro, TAM 810 milyon TL"),
  // üstelik Pazar Analisti aynı raporda "veri yok" derken. Kanıt yoksa kural
  // herkese uygulanır; arama bekleyen ajan bir madde fazlasını alır.
  if (!grounded) {
    prompt += NO_DATA_NOTICE;
    if (agent.grounded) prompt += NO_SEARCH_EXTRA;
  }
  return prompt;
}

/**
 * Kaynak getiremeyen bir ajanın "yüksek güven" demesini engeller.
 *
 * `confidence` alanı "veri yeterliliğine göre kendi güvenin" diye tanımlı.
 * Arama kapalıyken ve Data Room boşken ortada veri yoktur; modelin buna
 * rağmen HIGH demesi raporun en yanıltıcı kısmıydı — okuyucu doğrulanmamış
 * bir rakamı doğrulanmış sanıyordu. Prompt'ta rica etmek yetmez, sonucu
 * burada da kısıyoruz.
 */
function capConfidence(parsed: unknown, ceiling: "LOW" | "MEDIUM"): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const record = parsed as Record<string, unknown>;
  if (record.confidence !== "HIGH") return parsed;
  return { ...record, confidence: ceiling };
}

/** Simülasyon sağlayıcısıyla tek çalıştırma. Şema doğrulaması aynen uygulanır. */
async function runSimulated(
  key: AgentKey,
  ctx: AgentContext,
  began: number,
): Promise<AgentExecution> {
  const agent = AGENTS[key];
  const result = await getSimulationProvider().complete({
    model: SIMULATION_MODEL,
    systemPrompt: agent.systemPrompt,
    userPrompt: agent.buildUserPrompt(ctx),
    jsonSchema: toGeminiSchema(agent.schema),
    grounded: false,
    agentKey: key,
    context: ctx,
  });

  return {
    parsed: agent.schema.parse(result.json),
    model: SIMULATION_MODEL,
    simulated: true,
    citations: result.citations,
    promptTokens: result.promptTokens,
    outputTokens: result.outputTokens,
    latencyMs: Date.now() - began,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
