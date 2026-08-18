import { describe, expect, it } from "vitest";
import { AGENTS, AGENT_KEYS, ROUND_AGENTS, type AgentContext } from "@/lib/agents/definitions";
import { toGeminiSchema } from "@/lib/agents/schemas";
import { SimulationProvider } from "@/lib/llm/simulation";
import type { InvestorOutput, SkepticOutput } from "@/lib/agents/schemas";

const IDEA = `Küçük hukuk bürolarının duruşma tarihlerini ve yasal süreleri otomatik takip eden,
süre kaçırma riskini önceden uyaran bir asistan. Hedef kitle 1-5 avukatlı bürolar.`;

const provider = new SimulationProvider();

async function runAgent(key: (typeof AGENT_KEYS)[number], ctx: AgentContext) {
  const agent = AGENTS[key];
  const result = await provider.complete({
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    userPrompt: agent.buildUserPrompt(ctx),
    jsonSchema: toGeminiSchema(agent.schema),
    grounded: agent.grounded,
    agentKey: key,
    context: ctx,
  });
  return agent.schema.parse(result.json);
}

/** Turların gerçek sırasıyla bağlam kuran, DB'siz mini orkestratör. */
async function runAllRounds(): Promise<AgentContext> {
  const ctx: AgentContext = { ideaText: IDEA, round1: {}, investors: [] };

  for (const key of ROUND_AGENTS[1]) {
    ctx.round1[key] = await runAgent(key, ctx);
  }
  ctx.skeptic = (await runAgent("skeptic", ctx)) as SkepticOutput;
  ctx.advocate = (await runAgent("advocate", ctx)) as AgentContext["advocate"];

  for (const key of ROUND_AGENTS[3]) {
    ctx.investors.push({
      key,
      name: AGENTS[key].name,
      output: (await runAgent(key, ctx)) as InvestorOutput,
    });
  }
  await runAgent("chair", ctx);
  return ctx;
}

describe("ajan sözleşmeleri", () => {
  it("her ajanın şeması Gemini'nin kabul ettiği biçime çevrilebilir", () => {
    for (const key of AGENT_KEYS) {
      const schema = toGeminiSchema(AGENTS[key].schema);
      expect(schema.type, key).toBe("object");
      expect(schema.properties, key).toBeTruthy();
      // Gemini bu iki anahtarı reddediyor; temizlenmiş olmaları şart.
      expect(JSON.stringify(schema)).not.toContain("$schema");
      expect(JSON.stringify(schema)).not.toContain("additionalProperties");
    }
  });

  it("her ajanın promptu bağlamı gerçekten kullanıyor", () => {
    const ctx: AgentContext = { ideaText: IDEA, round1: {}, investors: [] };
    for (const key of AGENT_KEYS) {
      expect(AGENTS[key].buildUserPrompt(ctx), key).toContain(IDEA.trim().slice(0, 40));
    }
  });

  it("her ajanın teşviki tanımlı ve benzersiz", () => {
    const incentives = AGENT_KEYS.map((key) => AGENTS[key].incentive);
    expect(new Set(incentives).size).toBe(AGENT_KEYS.length);
  });
});

describe("simülasyon sağlayıcısı", () => {
  it("11 ajanın tamamı için şemaya uyan çıktı üretir", async () => {
    const ctx: AgentContext = { ideaText: IDEA, round1: {}, investors: [] };
    ctx.skeptic = undefined;

    // Şema ihlali olsaydı runAgent içindeki parse fırlatırdı.
    await expect(runAllRounds()).resolves.toBeTruthy();
    expect(ctx).toBeTruthy();
  }, 30_000);

  it("aynı fikirde deterministiktir — demo tekrar oynatılabilir olmalı", async () => {
    const ctx: AgentContext = { ideaText: IDEA, round1: {}, investors: [] };
    const first = await runAgent("market", ctx);
    const second = await runAgent("market", ctx);
    expect(first).toEqual(second);
  }, 20_000);

  it("farklı fikirler farklı sonuç üretir", async () => {
    const a = await runAgent("market", { ideaText: IDEA, round1: {}, investors: [] });
    const b = await runAgent("market", {
      ideaText: "Bulut tabanlı, çiftçiler için toprak nem sensörü verisi toplayan bir servis.",
      round1: {},
      investors: [],
    });
    expect(a).not.toEqual(b);
  }, 20_000);

  it("avukat, şüphecinin saldırı başlıklarını birebir cevaplar", async () => {
    const ctx = await runAllRounds();
    const attackTitles = ctx.skeptic!.attacks.map((attack) => attack.title);
    const answered = ctx.advocate!.rebuttals.map((rebuttal) => rebuttal.attackTitle);

    // Ekrandaki saldırı/savunma eşleşmesi bu sözleşmeye dayanıyor.
    for (const title of attackTitles) {
      expect(answered).toContain(title);
    }
  }, 30_000);

  it("avukat her saldırıyı savunmaz — en az bir kabul içerir", async () => {
    const ctx = await runAllRounds();
    const strategies = ctx.advocate!.rebuttals.map((rebuttal) => rebuttal.strategy);
    expect(strategies).toContain("CONCEDE");
  }, 30_000);
});
