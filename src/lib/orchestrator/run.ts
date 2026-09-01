import {
  AGENTS,
  INVESTOR_KEYS,
  ROUND_AGENTS,
  ROUND_LABELS,
  SCORE_DIMENSIONS,
  type AgentContext,
  type AgentKey,
} from "@/lib/agents/definitions";
import { executeAgent } from "@/lib/agents/execute";
import type { ChairOutput, InvestorOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { isDatabaseUnavailableError, readDb } from "@/lib/db-errors";
import { getLlmProvider } from "@/lib/llm";
import { disagreementIndex, weightedOverall } from "@/lib/scoring";
import { emit, releaseQueue } from "./events";

// Aynı analizin iki kez başlatılmasını engeller (çift POST, hot reload, retry).
const running = new Set<string>();

/**
 * Analiz boyunca taşınan tek mutasyona açık bilgi.
 *
 * Sağlayıcı kotası analizin ortasında bitebilir; o noktadan sonraki ajanlar
 * simülasyonla üretilir. Kayıttaki `simulated` bayrağı bunu yansıtmalı, yoksa
 * arayüz şablon metni gerçek analiz gibi gösterir.
 */
interface RunState {
  simulated: boolean;
}

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
  const analysisResult = await readDb(
    prisma.analysis.findUnique({ where: { id: analysisId }, include: { evidence: true } }),
    null,
  );
  if (!analysisResult.value) return;
  const analysis = analysisResult.value;
  if (analysis.status !== "QUEUED") return;

  const provider = getLlmProvider();
  const state: RunState = { simulated: provider.id === "simulation" };

  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "RUNNING", simulated: state.simulated },
  });

  await emit(analysisId, "analysis.started", {
    title: analysis.title,
    simulated: state.simulated,
    provider: provider.id,
    totalAgents: Object.keys(AGENTS).length,
  });

  const dataRoom = analysis.evidence.length
    ? `\n\nDATA ROOM — KURUCUNUN SUNDUĞU KANITLAR\n${analysis.evidence
        .map((item) => `### ${item.title}${item.source ? ` (${item.source})` : ""}\n${item.content}`)
        .join("\n\n")}`
    : "";
  const ctx: AgentContext = {
    ideaText: `${analysis.ideaText}${dataRoom}`,
    hasEvidence: analysis.evidence.length > 0,
    round1: {},
    investors: [],
  };

  try {
    // ---------------------------------------------------- TUR 1 (5 paralel)
    await emit(analysisId, "round.started", { round: 1, label: ROUND_LABELS[1], agents: agentCards(1) });

    const round1 = await Promise.all(
      ROUND_AGENTS[1].map((key) => runAgent(analysisId, key, ctx, state).catch(() => null)),
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

    ctx.skeptic = (await runAgent(analysisId, "skeptic", ctx, state)) as AgentContext["skeptic"];
    ctx.advocate = (await runAgent(analysisId, "advocate", ctx, state)) as AgentContext["advocate"];

    await emit(analysisId, "round.completed", { round: 2 });

    // ---------------------------------------------------- TUR 3 (3 paralel)
    await emit(analysisId, "round.started", { round: 3, label: ROUND_LABELS[3], agents: agentCards(3) });

    // Tur 1 gibi toleranslı: yatırımcılar birbirinden bağımsız karar verir, biri
    // sağlayıcı hatasıyla düşerse kalanların kararı hâlâ geçerli bir sonuçtur.
    // Anlaşmazlık endeksi en az iki karar ister; altına inince analiz anlamını
    // yitirir ve durmak, yanıltıcı bir "fikir birliği" göstermekten iyidir.
    const investorResults = await Promise.all(
      INVESTOR_KEYS.map(async (key) => {
        const output = await runAgent(analysisId, key, ctx, state).catch(() => null);
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
    const chair = (await runAgent(analysisId, "chair", ctx, state)) as ChairOutput;
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
        // Kota analizin ortasında bitmiş olabilir; bayrak başlangıçtaki değil
        // gerçekleşen duruma göre yazılır.
        simulated: state.simulated,
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
    try {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
      });
    } catch (updateError) {
      if (!isDatabaseUnavailableError(updateError)) throw updateError;
      return;
    }

    try {
      await emit(analysisId, "analysis.failed", { error: message });
    } catch {
      /* event akışı DB kapanınca sessizce durur */
    }
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

/**
 * Tek bir ajanı çalıştırır, kaydeder ve olaylarını yayınlar.
 *
 * Model seçimi, yeniden deneme ve simülasyona düşme mantığı burada değil
 * `lib/agents/execute.ts`'te: offline yol da aynı merdiveni kullanıyor ve iki
 * kopyanın zamanla ayrışması bu dosyanın çözdüğü sorunu geri getirir.
 */
async function runAgent(
  analysisId: string,
  key: AgentKey,
  ctx: AgentContext,
  state: RunState,
): Promise<unknown> {
  const agent = AGENTS[key];
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

  try {
    const execution = await executeAgent(key, ctx, {
      onDegraded: ({ reason, message }) =>
        emit(analysisId, "agent.degraded", {
          agentKey: key,
          name: agent.name,
          round: agent.round,
          reason,
          message,
        }),
      onRetry: ({ attempt, waitMs }) =>
        emit(analysisId, "agent.started", {
          agentKey: key,
          name: agent.name,
          round: agent.round,
          retryOf: attempt,
          waitMs,
        }),
    });

    // Bir ajan bile simülasyona düştüyse analiz artık saf Gemini çıktısı değil.
    if (execution.simulated) state.simulated = true;

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        // Yedeğe ya da simülasyona düşülmüş olabilir; kayıtta gerçekten
        // kullanılan model durmalı.
        model: execution.model,
        rawJson: execution.parsed as never,
        promptTokens: execution.promptTokens,
        outputTokens: execution.outputTokens,
        latencyMs: execution.latencyMs,
        endedAt: new Date(),
      },
    });

    if (execution.citations.length) {
      await prisma.citation.createMany({
        data: execution.citations.map((c) => ({
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
      output: execution.parsed,
      citations: execution.citations,
      latencyMs: execution.latencyMs,
    });

    return execution.parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

    throw error instanceof Error ? error : new Error(message);
  }
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
