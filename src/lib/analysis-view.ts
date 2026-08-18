import { AGENT_KEYS, AGENT_META, type AgentKey } from "@/lib/agents/meta";

/**
 * Sunucu ve istemcinin paylaştığı görünüm modeli.
 *
 * Aynı ekran iki kaynaktan beslenebilmeli: tamamlanmış bir analizde DB
 * satırlarından, canlı analizde SSE olaylarından. İkisi de burada aynı şekle
 * indirgenir, böylece rapor bileşenleri tek bir tipe bakar.
 */

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface AgentView {
  key: AgentKey;
  status: AgentStatus;
  output: unknown;
  latencyMs: number | null;
  citations: Array<{ url: string; title: string; snippet?: string | null }>;
  error: string | null;
  /** Ajan planlanandan düşük yetenekle çalıştıysa nedeni (ör. arama kotası yok). */
  degraded: string | null;
}

export interface ScoreView {
  dimension: string;
  value: number;
  rationale: string;
}

export interface AnalysisView {
  id: string;
  title: string;
  ideaText: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  verdict: "GO" | "GO_IF" | "NO_GO" | null;
  overallScore: number | null;
  disagreement: number | null;
  simulated: boolean;
  version: number;
  parentId: string | null;
  errorMessage: string | null;
  createdAt: string;
  agents: Record<AgentKey, AgentView>;
  scores: ScoreView[];
  /** İşlenen son olayın sırası — yeniden bağlanmada buradan devam edilir. */
  lastSeq: number;
  /** Şu an çalışan tur; ilerleme çubuğu bunu okur. */
  activeRound: 1 | 2 | 3 | 4 | null;
}

export function emptyAgents(): Record<AgentKey, AgentView> {
  const agents = {} as Record<AgentKey, AgentView>;
  for (const key of AGENT_KEYS) {
    agents[key] = {
      key,
      status: "pending",
      output: null,
      latencyMs: null,
      citations: [],
      error: null,
      degraded: null,
    };
  }
  return agents;
}

/** DB satırlarından görünüm modeli. Sunucu bileşeni bunu kullanır. */
export function viewFromRows(input: {
  analysis: {
    id: string;
    title: string;
    ideaText: string;
    status: string;
    verdict: string | null;
    overallScore: number | null;
    disagreement: number | null;
    simulated: boolean;
    version: number;
    parentId: string | null;
    errorMessage: string | null;
    createdAt: Date;
  };
  runs: Array<{
    agentKey: string;
    status: string;
    rawJson: unknown;
    latencyMs: number | null;
    errorMessage: string | null;
    citations: Array<{ url: string; title: string; snippet: string | null }>;
  }>;
  scores: Array<{ dimension: string; value: number; rationale: string }>;
}): AnalysisView {
  const agents = emptyAgents();

  for (const run of input.runs) {
    const key = run.agentKey as AgentKey;
    if (!agents[key]) continue;
    agents[key] = {
      key,
      status: run.status.toLowerCase() as AgentStatus,
      output: run.rawJson ?? null,
      latencyMs: run.latencyMs,
      citations: run.citations,
      error: run.errorMessage,
      // Tamamlanmış ama kaynaksız kalan grounded ajan, aramanın çalışmadığını gösterir.
      degraded: null,
    };
  }

  return {
    id: input.analysis.id,
    title: input.analysis.title,
    ideaText: input.analysis.ideaText,
    status: input.analysis.status as AnalysisView["status"],
    verdict: input.analysis.verdict as AnalysisView["verdict"],
    overallScore: input.analysis.overallScore,
    disagreement: input.analysis.disagreement,
    simulated: input.analysis.simulated,
    version: input.analysis.version,
    parentId: input.analysis.parentId,
    errorMessage: input.analysis.errorMessage,
    createdAt: input.analysis.createdAt.toISOString(),
    agents,
    scores: sortScores(input.scores),
    lastSeq: 0,
    activeRound: null,
  };
}

export interface StreamEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Olayı görünüm modeline uygular. Saf fonksiyon — hem canlı akışta hem
 * replay'de aynı şekilde çalışır, bu yüzden demo modu ek kod gerektirmez.
 */
export function applyEvent(view: AnalysisView, event: StreamEvent): AnalysisView {
  const next: AnalysisView = { ...view, lastSeq: Math.max(view.lastSeq, event.seq) };
  const payload = event.payload;

  switch (event.type) {
    case "analysis.started":
      next.status = "RUNNING";
      next.simulated = Boolean(payload.simulated);
      break;

    case "round.started":
      next.activeRound = payload.round as AnalysisView["activeRound"];
      break;

    case "agent.started": {
      const key = payload.agentKey as AgentKey;
      if (!next.agents[key]) break;
      next.agents = { ...next.agents, [key]: { ...next.agents[key], status: "running" } };
      break;
    }

    case "agent.completed": {
      const key = payload.agentKey as AgentKey;
      if (!next.agents[key]) break;
      next.agents = {
        ...next.agents,
        [key]: {
          ...next.agents[key],
          status: "completed",
          output: payload.output ?? null,
          latencyMs: (payload.latencyMs as number) ?? null,
          citations: (payload.citations as AgentView["citations"]) ?? [],
        },
      };
      break;
    }

    case "agent.degraded": {
      const key = payload.agentKey as AgentKey;
      if (!next.agents[key]) break;
      next.agents = {
        ...next.agents,
        [key]: { ...next.agents[key], degraded: String(payload.message ?? "") },
      };
      break;
    }

    case "agent.failed": {
      const key = payload.agentKey as AgentKey;
      if (!next.agents[key]) break;
      next.agents = {
        ...next.agents,
        [key]: { ...next.agents[key], status: "failed", error: String(payload.error ?? "") },
      };
      break;
    }

    case "scores.computed":
      next.scores = sortScores((payload.scores as ScoreView[]) ?? []);
      next.overallScore = (payload.overall as number) ?? null;
      next.disagreement = (payload.disagreement as number) ?? null;
      break;

    case "analysis.completed":
      next.status = "COMPLETED";
      next.verdict = payload.verdict as AnalysisView["verdict"];
      next.overallScore = (payload.overall as number) ?? next.overallScore;
      next.disagreement = (payload.disagreement as number) ?? next.disagreement;
      next.activeRound = null;
      break;

    case "analysis.failed":
      next.status = "FAILED";
      next.errorMessage = String(payload.error ?? "Bilinmeyen hata");
      next.activeRound = null;
      break;
  }

  return next;
}

/** Boyutları ağırlık sırasında tutar — radar grafiğinin ekseni sabit kalsın. */
const DIMENSION_ORDER = [
  "Pazar Fırsatı",
  "Rekabet Avantajı",
  "Teknik Yapılabilirlik",
  "İş Modeli",
  "Risk Profili",
];

function sortScores(scores: ScoreView[]): ScoreView[] {
  return [...scores].sort(
    (a, b) => DIMENSION_ORDER.indexOf(a.dimension) - DIMENSION_ORDER.indexOf(b.dimension),
  );
}

export function completedCount(view: AnalysisView): number {
  return Object.values(view.agents).filter((a) => a.status === "completed").length;
}

export function agentsOfRound(view: AnalysisView, round: 1 | 2 | 3 | 4): AgentView[] {
  return Object.values(view.agents).filter((a) => AGENT_META[a.key].round === round);
}
