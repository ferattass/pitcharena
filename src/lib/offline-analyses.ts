import {
  AGENTS,
  INVESTOR_KEYS,
  ROUND_AGENTS,
  SCORE_DIMENSIONS,
  type AgentContext,
  type AgentKey,
} from "@/lib/agents/definitions";
import { executeAgent } from "@/lib/agents/execute";
import type { ChairOutput, InvestorOutput } from "@/lib/agents/schemas";
import { deriveTitle, hashIdea } from "@/lib/idea";
import { getLlmProvider } from "@/lib/llm";
import { disagreementIndex, weightedOverall } from "@/lib/scoring";

export interface OfflineEvidenceInput {
  title: string;
  content: string;
  source?: string | null;
}

export interface OfflineAnalysisInput {
  ideaText: string;
  evidence: OfflineEvidenceInput[];
  parentId?: string | null;
}

export interface OfflineAnalysisRecord {
  analysis: {
    id: string;
    title: string;
    ideaText: string;
    ideaHash: string;
    status: "COMPLETED";
    verdict: ChairOutput["verdict"];
    overallScore: number;
    disagreement: number;
    errorMessage: string | null;
    parentId: string | null;
    version: number;
    simulated: boolean;
    createdAt: Date;
    completedAt: Date;
  };
  runs: Array<{
    agentKey: string;
    status: "COMPLETED" | "FAILED";
    rawJson: unknown;
    latencyMs: number | null;
    errorMessage: string | null;
    citations: Array<{ url: string; title: string; snippet: string | null }>;
    model: string;
  }>;
  scores: Array<{ dimension: string; value: number; rationale: string }>;
  evidence: Array<{
    id: string;
    title: string;
    content: string;
    source: string | null;
    createdAt: Date;
  }>;
  challenges: Array<{
    id: string;
    question: string;
    context: string | null;
    answer: string | null;
    createdAt: Date;
    answeredAt: Date | null;
  }>;
  parent: { id: string; version: number; overallScore: number | null } | null;
  children: Array<{ id: string; version: number }>;
}

/**
 * Çevrimdışı analizlerin belleği.
 *
 * `globalThis`e sabitlenmesi şart, modül seviyesinde durması yetmez: Next
 * route handler'ları ile server component'ları ayrı modül grafiklerinde
 * paketliyor. Sıradan bir modül değişkeni olsaydı POST kaydı bir örneğe yazar,
 * detay sayfası bomboş bir başkasını okur ve analiz "bulunamadı" görünürdü.
 * Aynı sebeple hot reload da kayıtları silmiyor (bkz. lib/db.ts).
 */
const globalForOffline = globalThis as unknown as {
  offlineAnalyses?: Map<string, OfflineAnalysisRecord>;
};

const offlineAnalyses: Map<string, OfflineAnalysisRecord> = (globalForOffline.offlineAnalyses ??=
  new Map<string, OfflineAnalysisRecord>());

export function isOfflineAnalysisId(id: string): boolean {
  return id.startsWith("offline_");
}

export function findOfflineAnalysis(id: string): OfflineAnalysisRecord | null {
  return offlineAnalyses.get(id) ?? null;
}

export function listOfflineAnalyses(limit = 50): OfflineAnalysisRecord[] {
  return [...offlineAnalyses.values()]
    .sort((a, b) => b.analysis.createdAt.getTime() - a.analysis.createdAt.getTime())
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Türetilmiş okuyucular
//
// Panel, Raporlar, Eğilimler ve Simülasyon ekranları bu sayıları Prisma'nın
// groupBy/aggregate çıktısından okuyor. Her ekrana ayrı bir çevrimdışı dal
// yazmak yerine aynı biçimleri burada üretiyoruz: sayfalar tek satırlık bir
// yedekle yetiniyor ve dört ayrı kopyanın zamanla ayrışma riski kalmıyor.
// ---------------------------------------------------------------------------

/** `prisma.analysis.aggregate` ile aynı biçim. */
export function offlineAggregate() {
  const records = [...offlineAnalyses.values()];
  const scored = records.filter((r) => typeof r.analysis.overallScore === "number");
  const average = (pick: (r: OfflineAnalysisRecord) => number) =>
    scored.length ? scored.reduce((sum, r) => sum + pick(r), 0) / scored.length : null;

  return {
    _avg: {
      overallScore: average((r) => r.analysis.overallScore),
      disagreement: average((r) => r.analysis.disagreement),
    },
    _count: { _all: records.length },
  };
}

/** `prisma.score.groupBy({ by: ["dimension"] })` ile aynı biçim. */
export function offlineDimensionAverages() {
  const buckets = new Map<string, number[]>();
  for (const record of offlineAnalyses.values()) {
    for (const score of record.scores) {
      buckets.set(score.dimension, [...(buckets.get(score.dimension) ?? []), score.value]);
    }
  }
  return [...buckets].map(([dimension, values]) => ({
    dimension,
    _avg: { value: values.reduce((sum, value) => sum + value, 0) / values.length },
    _count: { _all: values.length },
  }));
}

/** `prisma.analysis.groupBy({ by: ["verdict"] })` ile aynı biçim. */
export function offlineVerdictGroups() {
  const counts = new Map<string, number>();
  for (const record of offlineAnalyses.values()) {
    const verdict = record.analysis.verdict;
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  }
  return [...counts].map(([verdict, count]) => ({ verdict, _count: { _all: count } }));
}

/** `prisma.agentRun.findMany({ where: { agentKey } })` ile aynı biçim. */
export function offlineAgentRuns(agentKey: string) {
  return [...offlineAnalyses.values()].flatMap((record) =>
    record.runs
      .filter((run) => run.agentKey === agentKey && run.status === "COMPLETED")
      .map((run) => ({ rawJson: run.rawJson })),
  );
}

/** En son tamamlanan analiz ve başkanın çıktısı — Panel'in kahraman kartı. */
export function offlineLatest() {
  const [record] = listOfflineAnalyses(1);
  if (!record) return null;
  return {
    ...record.analysis,
    runs: record.runs
      .filter((run) => run.agentKey === "chair")
      .map((run) => ({ rawJson: run.rawJson })),
  };
}

export async function createOfflineAnalysis(input: OfflineAnalysisInput): Promise<OfflineAnalysisRecord> {
  const parent = input.parentId ? findOfflineAnalysis(input.parentId) : null;
  const record = await buildOfflineAnalysis(input, parent);
  offlineAnalyses.set(record.analysis.id, record);

  if (parent) {
    parent.children = [...parent.children, { id: record.analysis.id, version: record.analysis.version }];
  }

  return record;
}

function makeId(): string {
  return `offline_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * DB kapalıyken analizi bellekte üretir.
 *
 * Orkestratörün turlarını ve toleranslarını birebir izler; tek fark kalıcılık
 * ve SSE'nin olmaması. Ajanlar `executeAgent` üzerinden çalışır — yani model
 * yedekleri ve kota bittiğinde simülasyona düşme burada da geçerlidir.
 */
async function buildOfflineAnalysis(
  input: OfflineAnalysisInput,
  parent: OfflineAnalysisRecord | null,
): Promise<OfflineAnalysisRecord> {
  const createdAt = new Date();
  const ideaText = input.ideaText.trim();
  const dataRoom = input.evidence.length
    ? `\n\nDATA ROOM\n${input.evidence.map((item) => `### ${item.title}\n${item.content}`).join("\n\n")}`
    : "";
  const ctx: AgentContext = {
    ideaText: `${ideaText}${dataRoom}`,
    hasEvidence: input.evidence.length > 0,
    round1: {},
    investors: [],
  };

  const runs: OfflineAnalysisRecord["runs"] = [];
  const state = { simulated: getLlmProvider().id === "simulation" };

  /** Ajanı çalıştırır ve sonucu kayda yazar. Hata çağırana geçer. */
  async function run(key: AgentKey): Promise<unknown> {
    try {
      const execution = await executeAgent(key, ctx);
      // Bir ajan bile simülasyona düştüyse analiz saf Gemini çıktısı değildir.
      if (execution.simulated) state.simulated = true;

      runs.push({
        agentKey: key,
        status: "COMPLETED",
        rawJson: execution.parsed,
        latencyMs: execution.latencyMs,
        errorMessage: null,
        citations: execution.citations.map((citation) => ({
          url: citation.url,
          title: citation.title,
          snippet: citation.snippet ?? null,
        })),
        model: execution.model,
      });
      return execution.parsed;
    } catch (error) {
      runs.push({
        agentKey: key,
        status: "FAILED",
        rawJson: null,
        latencyMs: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        citations: [],
        model: AGENTS[key].model,
      });
      throw error;
    }
  }

  /** Düşmesine izin verilen ajanlar için: hata yerine null döner. */
  const runTolerant = (key: AgentKey) => run(key).catch(() => null);

  // --------------------------------------------------------------- TUR 1
  // Beş bağımsız ajan; birbirini görmedikleri için paralel çalışırlar.
  const round1 = await Promise.all(ROUND_AGENTS[1].map(runTolerant));
  ROUND_AGENTS[1].forEach((key, i) => {
    if (round1[i] !== null) ctx.round1[key] = round1[i];
  });

  const survived = round1.filter((output) => output !== null).length;
  if (survived < 3) {
    throw new Error(
      `Tur 1'de 5 ajandan sadece ${survived} tanesi tamamlandı; sağlıklı bir analiz için yetersiz.`,
    );
  }

  // --------------------------------------------------------------- TUR 2
  // Avukat, şüphecinin saldırılarını görmek zorunda — bu yüzden sıralı.
  ctx.skeptic = (await run("skeptic")) as AgentContext["skeptic"];
  ctx.advocate = (await run("advocate")) as AgentContext["advocate"];

  // --------------------------------------------------------------- TUR 3
  // Tur 1 gibi toleranslı; anlaşmazlık endeksi en az iki karar ister.
  const investorResults = await Promise.all(
    INVESTOR_KEYS.map(async (key) => {
      const output = await runTolerant(key);
      return output === null ? null : { key, name: AGENTS[key].name, output: output as InvestorOutput };
    }),
  );

  const investorOutputs = investorResults.filter((entry) => entry !== null);
  if (investorOutputs.length < 2) {
    throw new Error(
      `Tur 3'te 3 yatırımcıdan sadece ${investorOutputs.length} tanesi karar verdi; anlaşmazlık ölçülemez.`,
    );
  }
  ctx.investors = investorOutputs;

  // --------------------------------------------------------------- TUR 4
  const chairOutput = (await run("chair")) as ChairOutput;

  const scores: OfflineAnalysisRecord["scores"] = SCORE_DIMENSIONS.flatMap(({ key, dimension }) => {
    const output = ctx.round1[key] as { score?: number; scoreRationale?: string } | undefined;
    if (!output || typeof output.score !== "number") return [];
    return [
      {
        dimension,
        value: output.score,
        rationale: output.scoreRationale ?? "",
      },
    ];
  });

  const overall = weightedOverall(scores);
  const disagreement = disagreementIndex(investorOutputs.map((entry) => entry.output.decision));

  const challenges = chairOutput.changeMyMind.map((item) => ({
    id: crypto.randomUUID(),
    question: item.item,
    context: item.why,
    answer: null,
    createdAt: new Date(),
    answeredAt: null,
  }));

  return {
    analysis: {
      id: makeId(),
      title: deriveTitle(ideaText),
      ideaText,
      ideaHash: hashIdea(ideaText),
      status: "COMPLETED",
      verdict: chairOutput.verdict,
      overallScore: overall,
      disagreement,
      errorMessage: null,
      parentId: parent?.analysis.id ?? input.parentId ?? null,
      version: parent ? parent.analysis.version + 1 : 1,
      simulated: state.simulated,
      createdAt,
      completedAt: new Date(),
    },
    runs,
    scores,
    evidence: input.evidence.map((item) => ({
      id: crypto.randomUUID(),
      title: item.title,
      content: item.content,
      source: item.source ?? null,
      createdAt: new Date(),
    })),
    challenges,
    parent: parent
      ? {
          id: parent.analysis.id,
          version: parent.analysis.version,
          overallScore: parent.analysis.overallScore,
        }
      : null,
    children: [],
  };
}

export function exportOfflineAnalysis(analysis: OfflineAnalysisRecord) {
  return {
    analysis: {
      ...analysis.analysis,
      createdAt: analysis.analysis.createdAt,
    },
    runs: analysis.runs,
    scores: analysis.scores,
    evidence: analysis.evidence,
    challenges: analysis.challenges,
    parent: analysis.parent,
    children: analysis.children,
  };
}
