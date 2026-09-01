import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeAgent, SIMULATION_MODEL } from "@/lib/agents/execute";
import { clearGroundingUnavailable, clearLlmUnavailable, isLlmUnavailable } from "@/lib/llm";
import { SimulationProvider } from "@/lib/llm/simulation";
import {
  ModelUnavailableError,
  RetryableLlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from "@/lib/llm/types";
import { createOfflineAnalysis } from "@/lib/offline-analyses";
import type { AgentContext } from "@/lib/agents/definitions";

const IDEA = `Küçük işletmeler için yapay zekâ destekli ön muhasebe ve nakit akışı tahmin
platformu. Fatura okur, gideri sınıflandırır, 90 günlük nakit projeksiyonu çıkarır.`;

const ctx = (): AgentContext => ({ ideaText: IDEA, round1: {}, investors: [] });

/**
 * Sağlayıcı tekili globalThis üzerinde tutuluyor (bkz. lib/llm/index.ts);
 * testler gerçek Gemini yerine buraya kendi sahtesini koyar.
 */
const globalForLlm = globalThis as unknown as { llmProvider?: LlmProvider };

const schemaValid = new SimulationProvider();

class FakeGemini implements LlmProvider {
  readonly id = "gemini" as const;
  readonly calls: LlmRequest[] = [];

  constructor(private readonly handler: (request: LlmRequest, call: number) => Promise<LlmResult>) {}

  async complete(request: LlmRequest): Promise<LlmResult> {
    this.calls.push(request);
    return this.handler(request, this.calls.length);
  }
}

/** Şemaya uyan bir yanıt — sahte sağlayıcının "başarılı" dalı için. */
const ok = (request: LlmRequest) => schemaValid.complete(request);

function install(handler: (request: LlmRequest, call: number) => Promise<LlmResult>): FakeGemini {
  const provider = new FakeGemini(handler);
  globalForLlm.llmProvider = provider;
  return provider;
}

beforeEach(() => {
  clearLlmUnavailable();
  clearGroundingUnavailable();
});

afterEach(() => {
  delete globalForLlm.llmProvider;
  clearLlmUnavailable();
  clearGroundingUnavailable();
});

describe("ajan çalıştırma merdiveni", () => {
  it("kota bittiğinde ajanı düşürmek yerine simülasyonla üretir", async () => {
    const degraded: string[] = [];
    const provider = install(async () => {
      throw new ModelUnavailableError("gemini-3.5-flash-lite", "Model kotası yok");
    });

    const execution = await executeAgent("business", ctx(), {
      onDegraded: ({ reason }) => void degraded.push(reason),
    });

    expect(execution.simulated).toBe(true);
    expect(execution.model).toBe(SIMULATION_MODEL);
    expect(execution.parsed).toBeTruthy();
    expect(degraded).toEqual(["provider-quota"]);
    // Kotası olmayan modele tek bir çağrı yapılmalı, üç kez denenmemeli.
    expect(provider.calls).toHaveLength(1);
  });

  it("kota kilidi kalkınca sonraki ajanlar gerçek sağlayıcıya hiç gitmez", async () => {
    const provider = install(async () => {
      throw new ModelUnavailableError("gemini-3.5-flash-lite", "Model kotası yok");
    });

    await executeAgent("business", ctx());
    expect(isLlmUnavailable()).toBe(true);

    await executeAgent("risk", ctx());
    // İkinci ajan doğrudan simülasyona gitti: çağrı sayısı artmadı.
    expect(provider.calls).toHaveLength(1);
  });

  it("geçici hatada yeniden dener, sonra simülasyona düşer ama kilidi kaldırmaz", async () => {
    const provider = install(async () => {
      throw new RetryableLlmError("Geçici sağlayıcı hatası", 0);
    });

    const execution = await executeAgent("business", ctx());

    expect(execution.simulated).toBe(true);
    expect(provider.calls).toHaveLength(3);
    // Geçici arıza kalıcı değil; sonraki ajan gerçek sağlayıcıyı tekrar denemeli.
    expect(isLlmUnavailable()).toBe(false);
  });

  it("arama kotası yoksa önce grounding'i kapatır, simülasyona düşmez", async () => {
    const degraded: string[] = [];
    const provider = install(async (request) => {
      if (request.grounded) throw new ModelUnavailableError(request.model, "Model kotası yok");
      return ok(request);
    });

    const execution = await executeAgent("market", ctx(), {
      onDegraded: ({ reason }) => void degraded.push(reason),
    });

    expect(execution.simulated).toBe(false);
    expect(degraded).toEqual(["grounding-quota"]);
    expect(provider.calls.map((call) => call.grounded)).toEqual([true, false]);
    expect(isLlmUnavailable()).toBe(false);
  });

  it("arama kapalıyken modele bunu söyler — uydurma rakip/sayı üretmesin diye", async () => {
    const provider = install(async (request) => {
      if (request.grounded) throw new ModelUnavailableError(request.model, "Model kotası yok");
      return ok(request);
    });

    await executeAgent("market", ctx());

    const [withSearch, withoutSearch] = provider.calls;
    expect(withSearch.userPrompt).not.toContain("DOĞRULANMIŞ VERİ YOK");
    // Model aramanın kapandığını bilmezse kendini aramış sayıp uydurur.
    expect(withoutSearch.userPrompt).toContain("DOĞRULANMIŞ VERİ YOK");
    expect(withoutSearch.userPrompt).toContain("OLGU İDDİASI YAZMA");
    expect(withoutSearch.userPrompt).toContain("Veri yok — doğrulanamıyor");
  });

  it("kaynaksız ve kanıtsız ajan «yüksek güven» diyemez", async () => {
    install(async (request) => {
      if (request.grounded) throw new ModelUnavailableError(request.model, "Model kotası yok");
      const result = await ok(request);
      // Model prompt'a rağmen HIGH dese bile sonuç kısılmalı.
      return { ...result, json: { ...(result.json as object), confidence: "HIGH" } };
    });

    const sourceless = await executeAgent("market", ctx());
    expect((sourceless.parsed as { confidence: string }).confidence).toBe("LOW");

    // Aynı ajan Data Room kanıtıyla çalışıyorsa dayanağı vardır; kısılmaz.
    clearGroundingUnavailable();
    const withEvidence = await executeAgent("market", { ...ctx(), hasEvidence: true });
    expect((withEvidence.parsed as { confidence: string }).confidence).toBe("HIGH");
  });

  it("kural aramasız muhakeme ajanlarını da kapsar — olgu uydurmasınlar", async () => {
    // İş Modeli ajanı grounded değil; kural yalnızca grounded ajanlara
    // uygulandığında raporun en kesin görünen uydurma sayıları buradan
    // geliyordu ("Türkiye'de 45 bin büro, TAM 810 milyon TL").
    const provider = install(async (request) => {
      const result = await ok(request);
      return { ...result, json: { ...(result.json as object), confidence: "HIGH" } };
    });

    const execution = await executeAgent("business", ctx());

    expect(provider.calls[0].userPrompt).toContain("DOĞRULANMIŞ VERİ YOK");
    // Muhakeme ajanının tavanı MEDIUM: işi olgu getirmek değildi.
    expect((execution.parsed as { confidence: string }).confidence).toBe("MEDIUM");
  });

  it("Data Room doluysa ajana önce kanıta dayanmasını söyler", async () => {
    const provider = install(ok);

    await executeAgent("business", { ...ctx(), hasEvidence: true });

    expect(provider.calls[0].userPrompt).toContain("DATA ROOM ÖNCELİKLİ");
  });

  it("arama kotası bir kez öğrenilir; sonraki grounded ajan boşuna 429 yemez", async () => {
    const provider = install(async (request) => {
      if (request.grounded) throw new ModelUnavailableError(request.model, "Model kotası yok");
      return ok(request);
    });

    await executeAgent("market", ctx());
    expect(provider.calls.map((call) => call.grounded)).toEqual([true, false]);

    const degraded: string[] = [];
    await executeAgent("competitor", ctx(), {
      onDegraded: ({ reason }) => void degraded.push(reason),
    });

    // İkinci grounded ajan doğrudan aramasız başladı: yeni bir arama çağrısı yok.
    expect(provider.calls.map((call) => call.grounded)).toEqual([true, false, false]);
    expect(degraded).toEqual(["grounding-quota"]);
  });

  it("şema ihlalini simülasyonla örtmez — hata çağırana geçer", async () => {
    install(async () => ({ json: { hepsi: "yanlış" }, promptTokens: null, outputTokens: null, citations: [] }));

    await expect(executeAgent("business", ctx())).rejects.toThrow();
    expect(isLlmUnavailable()).toBe(false);
  });
});

describe("çevrimdışı analiz", () => {
  it("sağlayıcı tamamen kotasızken bile tamamlanmış bir analiz üretir", async () => {
    install(async () => {
      throw new ModelUnavailableError("gemini-3.5-flash-lite", "Model kotası yok");
    });

    const record = await createOfflineAnalysis({ ideaText: IDEA, evidence: [] });

    expect(record.analysis.status).toBe("COMPLETED");
    expect(record.analysis.verdict).toBeTruthy();
    // Tek bir ajan bile simülasyondan geldiyse kayıt bunu açıkça söylemeli.
    expect(record.analysis.simulated).toBe(true);
    expect(record.runs.every((run) => run.status === "COMPLETED")).toBe(true);
    expect(record.scores).toHaveLength(5);
  });
});
