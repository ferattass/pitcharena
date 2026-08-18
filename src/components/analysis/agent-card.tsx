import { Check, ChevronDown, CircleDashed, Globe, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AGENT_META, type AgentAccent } from "@/lib/agents/meta";
import type { AgentView } from "@/lib/analysis-view";
import { cn } from "@/lib/utils";
import { AgentOutput } from "./agent-output";

const ACCENT_BAR: Record<AgentAccent, string> = {
  neutral: "bg-electric-500",
  attack: "bg-verdict-nogo",
  defense: "bg-verdict-go",
  investor: "bg-navy-400",
  chair: "bg-navy-900",
};

/**
 * Tek bir ajanın kartı. `<details>` kullanır: JavaScript olmadan da açılıp
 * kapanır ve klavyeyle erişilebilir.
 */
export function AgentCard({ agent, defaultOpen }: { agent: AgentView; defaultOpen?: boolean }) {
  const meta = AGENT_META[agent.key];
  const done = agent.status === "completed";

  return (
    <details
      open={defaultOpen && done}
      className={cn(
        "group overflow-hidden rounded-2xl border border-hairline bg-card shadow-card transition-shadow",
        done && "hover:shadow-lift",
        !done && "opacity-95",
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 p-4",
          !done && "cursor-default",
        )}
      >
        <span className={cn("h-9 w-1 shrink-0 rounded-full", ACCENT_BAR[meta.accent])} aria-hidden />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-navy-900">{meta.name}</span>
            {meta.grounded && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-navy-400"
                title="Google Search ile kaynaklandırılır"
              >
                <Globe className="size-3" aria-hidden />
                kaynaklı
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-navy-500">{meta.incentive}</span>
        </span>

        <StatusPill agent={agent} />

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-navy-300 transition-transform group-open:rotate-180",
            !done && "invisible",
          )}
          aria-hidden
        />
      </summary>

      {done || agent.status === "failed" ? (
        <div className="border-t border-hairline p-4">
          {agent.degraded && (
            <p className="mb-3 rounded-lg bg-verdict-goif/10 px-3 py-2 text-[12px] leading-relaxed text-navy-700">
              {agent.degraded}
            </p>
          )}
          <AgentOutput agent={agent} />
        </div>
      ) : null}
    </details>
  );
}

function StatusPill({ agent }: { agent: AgentView }) {
  switch (agent.status) {
    case "running":
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-electric-50 px-2 py-1 text-[11px] font-semibold text-electric-700">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          düşünüyor
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-navy-400">
          <Check className="size-3.5 text-verdict-go" aria-hidden />
          {agent.latencyMs ? `${(agent.latencyMs / 1000).toFixed(1)}s` : "hazır"}
        </span>
      );
    case "failed":
      return (
        <Badge variant="nogo">
          <X className="size-3" aria-hidden />
          başarısız
        </Badge>
      );
    default:
      return (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-navy-300">
          <CircleDashed className="size-3.5" aria-hidden />
          sırada
        </span>
      );
  }
}
