import { GoogleGenAI } from "@google/genai";
import {
  ModelUnavailableError,
  RetryableLlmError,
  type LlmCitation,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from "./types";

/**
 * Gerçek Gemini sağlayıcısı.
 *
 * İki not:
 * 1. Grounding (Google Search) ile yapısal çıktı aynı çağrıda birlikte
 *    desteklenmiyor. Grounded ajanlarda şemayı prompt'a gömüp metinden JSON
 *    ayıklıyoruz; grounded olmayanlarda native responseJsonSchema kullanıyoruz.
 * 2. Ücretsiz katman kotası dar — dakika başı çağrı sınırı burada uygulanır.
 */
export class GeminiProvider implements LlmProvider {
  readonly id = "gemini" as const;
  private readonly client: GoogleGenAI;
  private readonly limiter: RateLimiter;

  constructor(apiKey: string, rpmLimit: number) {
    this.client = new GoogleGenAI({ apiKey });
    this.limiter = new RateLimiter(rpmLimit);
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    await this.limiter.acquire();

    const groundedSuffix = request.grounded
      ? `\n\nÇIKTI BİÇİMİ\nSadece aşağıdaki JSON şemasına uyan tek bir JSON nesnesi döndür. Kod bloğu, açıklama veya başka metin ekleme.\n${JSON.stringify(request.jsonSchema)}`
      : "";

    let response;
    try {
      response = await this.client.models.generateContent({
        model: request.model,
        contents: request.userPrompt + groundedSuffix,
        config: {
          systemInstruction: request.systemPrompt,
          temperature: 0.7,
          ...(request.grounded
            ? { tools: [{ googleSearch: {} }] }
            : {
                responseMimeType: "application/json",
                responseJsonSchema: request.jsonSchema,
              }),
        },
      });
    } catch (error) {
      throw normalizeError(error, request.model);
    }

    const text = response.text;
    if (!text) {
      throw new RetryableLlmError("Model boş yanıt döndürdü");
    }

    const usage = response.usageMetadata;
    return {
      json: parseJson(text),
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      citations: extractCitations(response),
    };
  }
}

/** Model bazen JSON'u kod bloğuna sarar veya önüne bir cümle koyar. */
function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // İlk `{` ile son `}` arasını dene — çevresinde açıklama varsa kurtarır.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* aşağıdaki hataya düş */
      }
    }
    throw new RetryableLlmError("Model geçerli JSON döndürmedi");
  }
}

function extractCitations(response: {
  candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>;
}): LlmCitation[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const citations: LlmCitation[] = [];

  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    citations.push({ url, title: chunk.web?.title ?? url });
  }
  return citations;
}

function normalizeError(error: unknown, model: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;

  // Model bu anahtara kapalı. Google eski modelleri listelemeye devam ediyor
  // ama yeni hesaplara 404 dönüyor — beklemek işe yaramaz, model değişmeli.
  if (status === 404 || /NOT_FOUND|no longer available|is not found/i.test(message)) {
    return new ModelUnavailableError(model, `Model çağrılamıyor (${model}): ${message}`);
  }

  // Kota hatası: dakikalık sınır ise beklemek işe yarar, günlük/plan sınırı
  // ise yaramaz. Ayrımı mesajdan yapıyoruz.
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
    if (/per minute|rate limit|requests per/i.test(message)) {
      return new RetryableLlmError(`Dakikalık sınır aşıldı: ${message}`, 20_000);
    }
    return new ModelUnavailableError(model, `Model kotası yok (${model}): ${message}`);
  }

  if ((status && status >= 500) || /fetch failed|ECONNRESET|ETIMEDOUT|UNAVAILABLE|high demand/i.test(message)) {
    return new RetryableLlmError(`Geçici sağlayıcı hatası: ${message}`);
  }
  return new Error(`Gemini hatası: ${message}`);
}

/**
 * Kayan pencereli dakika başı çağrı sınırı. Ücretsiz katmanın RPM limitini
 * aşmamak için orkestratör paralel ajanları buradan geçirir.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly rpm: number) {}

  acquire(): Promise<void> {
    // Sıraya alarak eş zamanlı çağrıların aynı boşluğu kapmasını engelliyoruz.
    const next = this.queue.then(() => this.reserve());
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async reserve(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < 60_000);

      if (this.timestamps.length < this.rpm) {
        this.timestamps.push(now);
        return;
      }

      const waitMs = 60_000 - (now - this.timestamps[0]) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
