import { AGENT_META, ROUND_AGENTS, ROUND_LABELS, ROUND_SUBTITLES } from "@/lib/agents/meta";
import type { AnalysisView } from "@/lib/analysis-view";
import { cn } from "@/lib/utils";
import { AgentCard } from "./agent-card";

/** Bir turun ajan kartları. Tur 1 ızgara, diğerleri tek sütun. */
export function RoundSection({
  view,
  round,
  defaultOpen,
}: {
  view: AnalysisView;
  round: 1 | 2 | 3 | 4;
  defaultOpen?: boolean;
}) {
  const keys = ROUND_AGENTS[round];
  const done = keys.filter((key) => view.agents[key].status === "completed").length;
  const active = view.activeRound === round;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <span
            className={cn(
              "grid size-5 place-items-center rounded-md text-[11px] font-bold",
              active ? "bg-electric-500 text-white" : "bg-navy-100 text-navy-500",
            )}
          >
            {round}
          </span>
          {ROUND_LABELS[round]}
        </h3>
        <span className="text-[12px] text-navy-400">
          {done}/{keys.length} ajan
        </span>
      </div>

      <p className="mt-1 text-[12px] leading-relaxed text-navy-500">{ROUND_SUBTITLES[round]}</p>

      <div
        className={cn(
          "mt-3 gap-3",
          round === 1 ? "grid md:grid-cols-2" : "flex flex-col",
        )}
      >
        {keys.map((key) => (
          <AgentCard
            key={key}
            agent={view.agents[key]}
            defaultOpen={defaultOpen ?? AGENT_META[key].round >= 2}
          />
        ))}
      </div>
    </section>
  );
}
