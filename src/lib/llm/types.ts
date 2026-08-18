import type { AgentContext, AgentKey } from "@/lib/agents/definitions";

export interface LlmCitation {
  url: string;
  title: string;
  snippet?: string;
}

export interface LlmRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  /** Modelin uymak zorunda olduğu JSON şeması (draft-07). */
  jsonSchema: Record<string, unknown>;
  /** Google Search grounding istenip istenmediği. */
  grounded: boolean;

  // Aşağıdaki iki alan yalnızca simülasyon sağlayıcısı içindir; Gemini
  // sağlayıcısı bunları yok sayar çünkü bilgi zaten userPrompt'a gömülüdür.
  agentKey: AgentKey;
  context: AgentContext;
}

export interface LlmResult {
  /** Doğrulanmamış ham JSON. Şema doğrulaması çağıran tarafta yapılır. */
  json: unknown;
  promptTokens: number | null;
  outputTokens: number | null;
  citations: LlmCitation[];
}

export interface LlmProvider {
  /** "gemini" veya "simulation" — DB'ye ve arayüze bu yazılır. */
  readonly id: "gemini" | "simulation";
  complete(request: LlmRequest): Promise<LlmResult>;
}

/**
 * Model bu anahtarla çağrılamıyor: kapatılmış (404) ya da kotası yok (429).
 *
 * Beklemek bunu çözmez — orkestratör aynı modeli tekrar denemek yerine
 * ajanın yedek model zincirindeki sıradakine geçer.
 */
export class ModelUnavailableError extends Error {
  constructor(
    readonly model: string,
    message: string,
  ) {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

/** Yeniden denenebilir hata (5xx, ağ, geçici aşırı yük). Backoff uygulanır. */
export class RetryableLlmError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RetryableLlmError";
  }
}
