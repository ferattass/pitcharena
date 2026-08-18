import { describe, expect, it } from "vitest";
import {
  applyEvent,
  completedCount,
  emptyAgents,
  type AnalysisView,
  type StreamEvent,
} from "@/lib/analysis-view";
import { deriveTitle, hashIdea } from "@/lib/idea";

function baseView(): AnalysisView {
  return {
    id: "a1",
    title: "Test fikri",
    ideaText: "Test fikri metni",
    status: "QUEUED",
    verdict: null,
    overallScore: null,
    disagreement: null,
    simulated: false,
    version: 1,
    parentId: null,
    errorMessage: null,
    createdAt: new Date(0).toISOString(),
    agents: emptyAgents(),
    scores: [],
    lastSeq: 0,
    activeRound: null,
  };
}

function event(seq: number, type: string, payload: Record<string, unknown> = {}): StreamEvent {
  return { seq, type, payload };
}

describe("applyEvent", () => {
  it("analiz başlayınca durumu ve sağlayıcıyı işaretler", () => {
    const view = applyEvent(baseView(), event(1, "analysis.started", { simulated: true }));
    expect(view.status).toBe("RUNNING");
    expect(view.simulated).toBe(true);
    expect(view.lastSeq).toBe(1);
  });

  it("ajan yaşam döngüsünü sırayla takip eder", () => {
    let view = baseView();
    view = applyEvent(view, event(1, "agent.started", { agentKey: "market" }));
    expect(view.agents.market.status).toBe("running");

    view = applyEvent(
      view,
      event(2, "agent.completed", {
        agentKey: "market",
        output: { score: 70 },
        latencyMs: 900,
        citations: [],
      }),
    );
    expect(view.agents.market.status).toBe("completed");
    expect(view.agents.market.latencyMs).toBe(900);
    expect(completedCount(view)).toBe(1);
  });

  it("başarısız ajanı hatasıyla saklar, diğerlerini etkilemez", () => {
    let view = baseView();
    view = applyEvent(view, event(1, "agent.failed", { agentKey: "risk", error: "kota" }));
    expect(view.agents.risk.status).toBe("failed");
    expect(view.agents.risk.error).toBe("kota");
    expect(view.agents.market.status).toBe("pending");
  });

  it("skorları radar grafiğinin beklediği sırada tutar", () => {
    const view = applyEvent(
      baseView(),
      event(1, "scores.computed", {
        scores: [
          { dimension: "Risk Profili", value: 40, rationale: "" },
          { dimension: "Pazar Fırsatı", value: 80, rationale: "" },
        ],
        overall: 62,
        disagreement: 50,
      }),
    );
    expect(view.scores.map((score) => score.dimension)).toEqual([
      "Pazar Fırsatı",
      "Risk Profili",
    ]);
    expect(view.overallScore).toBe(62);
  });

  it("tamamlanma olayı kararı yazar ve aktif turu kapatır", () => {
    let view = applyEvent(baseView(), event(1, "round.started", { round: 3 }));
    expect(view.activeRound).toBe(3);

    view = applyEvent(view, event(2, "analysis.completed", { verdict: "GO_IF", overall: 61 }));
    expect(view.status).toBe("COMPLETED");
    expect(view.verdict).toBe("GO_IF");
    expect(view.activeRound).toBeNull();
  });

  it("bilinmeyen olay tipini yok sayar ama seq'i ilerletir", () => {
    const view = applyEvent(baseView(), event(7, "gelecekteki.olay"));
    expect(view.status).toBe("QUEUED");
    expect(view.lastSeq).toBe(7);
  });

  it("tanınmayan ajan anahtarında çökmez", () => {
    const view = applyEvent(baseView(), event(1, "agent.started", { agentKey: "yok" }));
    expect(view.lastSeq).toBe(1);
  });

  it("olayları tekrar uygulamak sonucu bozmaz — replay güvenli", () => {
    const events = [
      event(1, "analysis.started", { simulated: true }),
      event(2, "agent.started", { agentKey: "market" }),
      event(3, "agent.completed", { agentKey: "market", output: { score: 70 }, citations: [] }),
      event(4, "analysis.completed", { verdict: "GO", overall: 70, disagreement: 0 }),
    ];

    const once = events.reduce(applyEvent, baseView());
    const twice = events.reduce(applyEvent, once);
    expect(twice).toEqual(once);
  });
});

describe("fikir normalleştirme", () => {
  it("aynı fikrin farklı yazımı aynı hash'i verir", () => {
    expect(hashIdea("  Bir Fikir   metni ")).toBe(hashIdea("bir fikir metni"));
  });

  it("farklı fikirler farklı hash üretir", () => {
    expect(hashIdea("bir fikir")).not.toBe(hashIdea("başka fikir"));
  });

  it("başlığı ilk cümleden türetir ve uzunsa kısaltır", () => {
    expect(deriveTitle("Kısa bir fikir. İkinci cümle burada.")).toBe("Kısa bir fikir.");
    expect(deriveTitle("x".repeat(200)).length).toBeLessThanOrEqual(72);
  });
});
