import {
  AGENTS,
  INVESTOR_KEYS,
  ROUND_AGENTS,
  ROUND_LABELS,
  SCORE_DIMENSIONS,
  type AgentContext,
  type AgentKey,
} from "@/lib/agents/definitions";
import { toGeminiSchema } from "@/lib/agents/schemas";
import type { ChairOutput, InvestorOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { getLlmProvider } from "@/lib/llm";
import { ModelUnavailableError, RetryableLlmError } from "@/lib/llm/types";
import { disagreementIndex, weightedOverall } from "@/lib/scoring";
import { emit, releaseQueue } from "./events";

const MAX_ATTEMPTS = 3;

// Aynı analizin iki kez başlatılmasını engeller (çift POST, hot reload, retry).
const running = new Set<string>();

/**
 * Analizi arka planda başlatır ve hemen döner. Çağıran cevabı beklemez;
 * istemci ilerlemeyi SSE üzerinden izler.
 */
export function startAnalysis(analysisId: string): void {
  if (running.has(analysisId)) return;
  running.add(analysisId);

  void runAnalysis(analysisId)
    .catch((error) => {
      console.error(`[orchestrator] ${analysisId} beklenmeyen hata:`, error);
    })
    .finally(() => {
      running.delete(analysisId);
      releaseQueue(analysisId);
    });
}

/**
 * Dört turluk durum makinesi.
 *
 * Her adım tamamlandığı anda DB'ye yazılır — orkestratör bellekte durum
 * taşımaz. Bir tur içindeki ajanlar birbirini beklemez, turlar arası geçişte
 * ise tam bariyer vardır: Tur 2 ancak Tur 1'in tamamını görebildiğinde başlar.
 */
export async function runAnalysis(analysisId: string): Promise<void> {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId }, include: { evidence: true } });
  if (!analysis) throw new Error(`Analiz bulunamadı: ${analysisId}`);
  if (analysis.status !== "QUEUED") return;

  const provider = getLlmProvider();
  const simulated = provider.id === "simulation";

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "RUNNING", simulated },
  });

  await emit(analysisId, "analysis.started", {
    title: analysis.title,
    simulated,
    provider: provider.id,
    totalAgents: Object.keys(AGENTS).length,
  });

  const dataRoom = analysis.evidence.length
    ? `\n\nDATA ROOM — KURUCUNUN SUNDUĞU KANITLAR\n${analysis.evidence
        .map((item) => `### ${item.title}${item.source ? ` (${item.source})` : ""}\n${item.content}`)
        .join("\n\n")}`
    : "";
  const ctx: AgentContext = { ideaText: `${analysis.ideaText}${dataRoom}`, round1: {}, investors: [] };

  try {
    // ---------------------------------------------------- TUR 1 (5 paralel)
    await emit(analysisId, "round.started", { round: 1, label: ROUND_LABELS[1], agents: agentCards(1) });

    const round1 = await Promise.all(
      ROUND_AGENTS[1].map((key) => runAgent(analysisId, key, ctx).catch(() => null)),
    );
    ROUND_AGENTS[1].forEach((key, i) => {
      if (round1[i] !== null) ctx.round1[key] = round1[i];
    });

    const survived = round1.filter((output) => output !== null).length;
    if (survived < 3) {
      throw new Error(
        `Tur 1'de 5 ajandan sadece ${survived} tanesi tamamlandı; sağlıklı bir analiz için yetersiz.`,
      );
    }
    await emit(analysisId, "round.completed", { round: 1, completed: survived });

    // ---------------------------------------------------- TUR 2 (sıralı)
    // Avukat, şüphecinin saldırılarını görmek zorunda — bu yüzden sıralı.
    await emit(analysisId, "round.started", { round: 2, label: ROUND_LABELS[2], agents: agentCards(2) });

    ctx.skeptic = (await runAgent(analysisId, "skeptic", ctx)) as AgentContext["skeptic"];
    ctx.advocate = (await runAgent(analysisId, "advocate", ctx)) as AgentContext["advocate"];

    await emit(analysisId, "round.completed", { round: 2 });

    // ---------------------------------------------------- TUR 3 (3 paralel)
    await emit(analysisId, "round.started", { round: 3, label: ROUND_LABELS[3], agents: agentCards(3) });

    // Tur 1 gibi toleranslı: yatırımcılar birbirinden bağımsız karar verir, biri
    // sağlayıcı hatasıyla düşerse kalanların kararı hâlâ geçerli bir sonuçtur.
    // Anlaşmazlık endeksi en az iki karar ister; altına inince analiz anlamını
    // yitirir ve durmak, yanıltıcı bir "fikir birliği" göstermekten iyidir.
    const investorResults = await Promise.all(
      INVESTOR_KEYS.map(async (key) => {
        const output = await runAgent(analysisId, key, ctx).catch(() => null);
        return output === null ? null : { key, name: AGENTS[key].name, output: output as InvestorOutput };
      }),
    );

    const investorOutputs = investorResults.filter((r) => r !== null);
    if (investorOutputs.length < 2) {
      throw new Error(
        `Tur 3'te 3 yatırımcıdan sadece ${investorOutputs.length} tanesi karar verdi; anlaşmazlık ölçülemez.`,
      );
    }
    ctx.investors = investorOutputs;

    await emit(analysisId, "round.completed", { round: 3, decisions: investorOutputs.map((i) => i.output.decision) });

    // ---------------------------------------------------- TUR 4 (sentez)
    await emit(analysisId, "round.started", { round: 4, label: ROUND_LABELS[4], agents: agentCards(4) });
    const chair = (await runAgent(analysisId, "chair", ctx)) as ChairOutput;
    await emit(analysisId, "round.completed", { round: 4 });

    // ---------------------------------------------------- skorlama
    const scores = await persistScores(analysisId, ctx);
    const overall = weightedOverall(scores);
    const disagreement = disagreementIndex(investorOutputs.map((i) => i.output.decision));

    await prisma.founderChallenge.createMany({
      data: chair.changeMyMind.map((item) => ({
        analysisId,
        question: item.item,
        context: item.why,
      })),
    });

    await emit(analysisId, "scores.computed", { scores, overall, disagreement });

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        verdict: chair.verdict,
        overallScore: overall,
        disagreement,
        completedAt: new Date(),
      },
    });

    await emit(analysisId, "analysis.completed", {
      verdict: chair.verdict,
      overall,
      disagreement,
      oneLiner: chair.oneLiner,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
    });
    await emit(analysisId, "analysis.failed", { error: message });
  }
}

function agentCards(round: 1 | 2 | 3 | 4) {
  return ROUND_AGENTS[round].map((key) => ({
    key,
    name: AGENTS[key].name,
    incentive: AGENTS[key].incentive,
    grounded: AGENTS[key].grounded,
  }));
}

/** Tek bir ajanı çalıştırır, doğrular, kaydeder ve olaylarını yayınlar. */
async function runAgent(analysisId: string, key: AgentKey, ctx: AgentContext): Promise<unknown> {
  const agent = AGENTS[key];
  const provider = getLlmProvider();
  const startedAt = new Date();

  const run = await prisma.agentRun.upsert({
    where: { analysisId_agentKey: { analysisId, agentKey: key } },
    create: {
      analysisId,
      agentKey: key,
      round: agent.round,
      model: agent.model,
      status: "RUNNING",
      startedAt,
    },
    update: { status: "RUNNING", startedAt, errorMessage: null },
  });

  await emit(analysisId, "agent.started", {
    agentKey: key,
    name: agent.name,
    incentive: agent.incentive,
    round: agent.round,
    model: agent.model,
    grounded: agent.grounded,
  });

  const began = Date.now();
  let lastError: unknown;

  // Birincil model + yedekleri. Bir model kapanmış ya da kotasız ise
  // beklemek işe yaramaz; sıradaki modele geçilir.
  const models = [agent.model, ...agent.fallbackModels];
  let modelIndex = 0;

  // Google Search grounding'in modelden AYRI bir kotası var ve ücretsiz
  // katmanda çoğu hesapta sıfır. Kaynaklandırma bir zenginleştirme, ön koşul
  // değil: kota yoksa ajanı düşürmek yerine aramasız çalıştırıyoruz.
  let grounded = agent.grounded;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = models[modelIndex];
    try {
      const result = await provider.complete({
        model,
        systemPrompt: agent.systemPrompt,
        userPrompt: agent.buildUserPrompt(ctx),
        jsonSchema: toGeminiSchema(agent.schema),
        grounded,
        agentKey: key,
        context: ctx,
      });

      // Şema doğrulaması: model sözleşmeyi bozduysa bu ajan başarısızdır.
      const parsed = agent.schema.parse(result.json);
      const latencyMs = Date.now() - began;

      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          // Yedeğe düşülmüş olabilir; kayıtta gerçekten kullanılan model durmalı.
          model,
          rawJson: parsed as never,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          endedAt: new Date(),
        },
      });

      if (result.citations.length) {
        await prisma.citation.createMany({
          data: result.citations.map((c) => ({
            agentRunId: run.id,
            url: c.url,
            title: c.title,
            snippet: c.snippet ?? null,
          })),
        });
      }

      await emit(analysisId, "agent.completed", {
        agentKey: key,
        name: agent.name,
        round: agent.round,
        output: parsed,
        citations: result.citations,
        latencyMs,
      });

      return parsed;
    } catch (error) {
      lastError = error;

      // Model kapalı ya da kotasız: aynı modeli tekrar denemek anlamsız.
      // Önce yedek modelleri dene, hepsi tükenirse grounding'i kapatıp
      // zinciri baştan yürü. Bu denemeler MAX_ATTEMPTS hakkından sayılmaz.
      if (error instanceof ModelUnavailableError) {
        if (modelIndex < models.length - 1) {
          modelIndex++;
          attempt--;
          continue;
        }
        if (grounded) {
          grounded = false;
          modelIndex = 0;
          attempt--;
          await emit(analysisId, "agent.degraded", {
            agentKey: key,
            name: agent.name,
            round: agent.round,
            reason: "grounding-quota",
            message:
              "Google Search kotası yok; bu ajan kaynaklandırma olmadan çalışıyor.",
          });
          continue;
        }
      }

      const retryable = error instanceof RetryableLlmError;
      if (!retryable || attempt === MAX_ATTEMPTS) break;

      // Üstel geri çekilme — ücretsiz katmanda 429 beklenen bir durumdur.
      const backoff = (error as RetryableLlmError).retryAfterMs ?? 1000 * 2 ** attempt;
      await emit(analysisId, "agent.started", {
        agentKey: key,
        name: agent.name,
        round: agent.round,
        retryOf: attempt,
        waitMs: backoff,
      });
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      errorMessage: message,
      latencyMs: Date.now() - began,
      endedAt: new Date(),
    },
  });
  await emit(analysisId, "agent.failed", {
    agentKey: key,
    name: agent.name,
    round: agent.round,
    error: message,
  });

  throw lastError instanceof Error ? lastError : new Error(message);
}

/** Tur 1 çıktılarındaki boyut puanlarını Score tablosuna yazar. */
async function persistScores(analysisId: string, ctx: AgentContext) {
  const scores: Array<{ dimension: string; value: number; rationale: string }> = [];

  for (const { key, dimension } of SCORE_DIMENSIONS) {
    const output = ctx.round1[key] as { score?: number; scoreRationale?: string } | undefined;
    if (!output || typeof output.score !== "number") continue;

    scores.push({
      dimension,
      value: output.score,
      rationale: output.scoreRationale ?? "",
    });
  }

  await prisma.$transaction(
    scores.map((score) =>
      prisma.score.upsert({
        where: { analysisId_dimension: { analysisId, dimension: score.dimension } },
        create: { analysisId, ...score },
        update: { value: score.value, rationale: score.rationale },
      }),
    ),
  );

  return scores;
}
