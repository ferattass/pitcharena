import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AGENT_META, INVESTOR_KEYS, SCORE_DIMENSIONS } from "@/lib/agents/meta";
import type { ChairOutput, InvestorOutput } from "@/lib/agents/schemas";
import type { AnalysisView } from "@/lib/analysis-view";
import { verdictHeadline, verdictLabel, verdictVariant } from "@/lib/constants";
import { disagreementLabel } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { DecisionTag } from "./agent-output";
import { ScoreRadar } from "./score-radar";

/** Raporun üst bloğu: karar, puan, anlaşmazlık ve beş boyut. */
export function VerdictPanel({ view }: { view: AnalysisView }) {
  const chair = view.agents.chair.output as ChairOutput | null;
  const variant = verdictVariant(view.verdict);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-lg font-bold tracking-tight",
                variant === "go" && "bg-verdict-go/10 text-verdict-go",
                variant === "goif" && "bg-verdict-goif/10 text-verdict-goif",
                variant === "nogo" && "bg-verdict-nogo/10 text-verdict-nogo",
                variant === "neutral" && "bg-navy-100 text-navy-600",
              )}
            >
              {verdictLabel(view.verdict)}
            </span>
            <span className="text-[13px] font-medium text-navy-500">
              {verdictHeadline(view.verdict)}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-navy-900">
            {chair?.oneLiner ?? view.title}
          </h2>

          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-navy-400">GENEL PUAN</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-navy-900">{view.overallScore ?? "—"}</span>
                <span className="text-sm text-navy-400">/ 100</span>
              </p>
              <p className="mt-1 text-[11px] text-navy-400">
                Beş boyutun ağırlıklı ortalaması
              </p>
            </div>

            <ConsensusMeter view={view} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-electric-500" aria-hidden />
            <h3 className="text-sm font-semibold">Skor profili</h3>
          </div>
          <ScoreRadar scores={view.scores} />
          <ScoreTable view={view} />
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Anlaşmazlık göstergesi — ürünün tezini görselleştiren tek grafik.
 * Üç yatırımcı ayrıştıysa bu bir kusur değil, gösterilecek bulgudur.
 */
function ConsensusMeter({ view }: { view: AnalysisView }) {
  if (view.disagreement === null) return null;

  const { label, tone } = disagreementLabel(view.disagreement);
  const decisions = INVESTOR_KEYS.map((key) => ({
    key,
    name: AGENT_META[key].name,
    decision: (view.agents[key].output as InvestorOutput | null)?.decision,
  })).filter((entry) => entry.decision);

  return (
    <div className="min-w-[240px] flex-1">
      <p className="text-[11px] font-semibold tracking-wide text-navy-400">ANLAŞMAZLIK ENDEKSİ</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-navy-900">{view.disagreement}</span>
        <Badge variant={tone === "consensus" ? "go" : tone === "split" ? "goif" : "nogo"}>
          {label}
        </Badge>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-navy-100">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "consensus" && "bg-verdict-go",
            tone === "split" && "bg-verdict-goif",
            tone === "contested" && "bg-verdict-nogo",
          )}
          style={{ width: `${Math.max(4, view.disagreement)}%` }}
        />
      </div>

      {decisions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {decisions.map((entry) => (
            <li key={entry.key} className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] text-navy-600">{entry.name}</span>
              <DecisionTag decision={entry.decision!} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreTable({ view }: { view: AnalysisView }) {
  if (!view.scores.length) return null;

  return (
    <ul className="mt-2 space-y-2.5">
      {view.scores.map((score) => {
        const weight = SCORE_DIMENSIONS.find((d) => d.dimension === score.dimension)?.weight ?? 0;
        return (
          <li key={score.dimension}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium text-navy-700">{score.dimension}</span>
              <span className="text-[12px] text-navy-400">
                <strong className="text-navy-900">{score.value}</strong> · %{Math.round(weight * 100)}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-navy-100">
              <div
                className="h-full rounded-full bg-electric-500"
                style={{ width: `${score.value}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
