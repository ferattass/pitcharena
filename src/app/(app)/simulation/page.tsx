import Link from "next/link";
import { Users } from "lucide-react";
import { DecisionTag } from "@/components/analysis/agent-output";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AGENT_META, INVESTOR_KEYS, type AgentKey } from "@/lib/agents/meta";
import type { InvestorOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { disagreementLabel } from "@/lib/scoring";

export const metadata = { title: "Yatırımcı simülasyonu · PitchArena" };
export const dynamic = "force-dynamic";

/**
 * Üç yatırımcının kararlarını analizler arasında yan yana koyar.
 *
 * Buradaki asıl bulgu tek bir analiz değil, örüntü: hangi tez hangi tür
 * fikri onaylıyor, ayrışma nerede yoğunlaşıyor.
 */
export default async function SimulationPage() {
  const analyses = await prisma.analysis.findMany({
    where: { status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      overallScore: true,
      disagreement: true,
      runs: {
        where: { agentKey: { in: INVESTOR_KEYS }, status: "COMPLETED" },
        select: { agentKey: true, rawJson: true },
      },
    },
  });

  const rows = analyses.map((analysis) => {
    const decisions = {} as Record<AgentKey, InvestorOutput | null>;
    for (const key of INVESTOR_KEYS) {
      const run = analysis.runs.find((r) => r.agentKey === key);
      decisions[key] = (run?.rawJson as InvestorOutput | null) ?? null;
    }
    return { ...analysis, decisions };
  });

  const stats = INVESTOR_KEYS.map((key) => {
    const outputs = rows.map((row) => row.decisions[key]).filter(Boolean) as InvestorOutput[];
    const count = (decision: string) => outputs.filter((o) => o.decision === decision).length;
    return {
      key,
      name: AGENT_META[key].name,
      incentive: AGENT_META[key].incentive,
      total: outputs.length,
      invest: count("INVEST"),
      followUp: count("FOLLOW_UP"),
      pass: count("PASS"),
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Yatırımcı simülasyonu</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-navy-500">
          Aynı fikre üç farklı yatırım teziyle bakılır. Ayrışmaları bir tutarsızlık değil —
          teşvikleri farklı olduğu için farklı karar vermeleri beklenir. Ürünün tezi tam olarak
          budur.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardBody className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-navy-900">{stat.name}</h2>
                  <p className="mt-0.5 text-[12px] text-navy-500">{stat.incentive}</p>
                </div>
                <Users className="size-4 shrink-0 text-navy-300" aria-hidden />
              </div>

              {stat.total === 0 ? (
                <p className="mt-4 text-[12px] text-navy-400">Henüz karar yok.</p>
              ) : (
                <>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-navy-100">
                    <span
                      className="bg-verdict-go"
                      style={{ width: `${(stat.invest / stat.total) * 100}%` }}
                    />
                    <span
                      className="bg-verdict-goif"
                      style={{ width: `${(stat.followUp / stat.total) * 100}%` }}
                    />
                    <span
                      className="bg-verdict-nogo"
                      style={{ width: `${(stat.pass / stat.total) * 100}%` }}
                    />
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                    <Stat label="Yatırım" value={stat.invest} tone="text-verdict-go" />
                    <Stat label="Takipte" value={stat.followUp} tone="text-verdict-goif" />
                    <Stat label="Geçer" value={stat.pass} tone="text-verdict-nogo" />
                  </dl>
                </>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-sm font-medium text-navy-700">Tamamlanmış analiz yok</p>
            <ButtonLink href="/analysis" variant="primary" className="mt-4">
              İlk analizi çalıştır
            </ButtonLink>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface">
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-navy-400">
                    Fikir
                  </th>
                  {INVESTOR_KEYS.map((key) => (
                    <th
                      key={key}
                      className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-navy-400"
                    >
                      {AGENT_META[key].name}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-navy-400">
                    Anlaşmazlık
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/analysis/${row.id}`}
                        className="text-[13px] font-medium text-navy-900 hover:text-electric-600"
                      >
                        {row.title}
                      </Link>
                      <span className="mt-0.5 block text-[11px] text-navy-400">
                        Genel puan {row.overallScore}
                      </span>
                    </td>
                    {INVESTOR_KEYS.map((key) => {
                      const output = row.decisions[key];
                      return (
                        <td key={key} className="px-4 py-3">
                          {output ? (
                            <span className="flex flex-col items-start gap-1">
                              <DecisionTag decision={output.decision} />
                              <span className="text-[11px] text-navy-400">
                                güven {output.conviction}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[12px] text-navy-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      {row.disagreement === null ? (
                        <span className="text-[12px] text-navy-300">—</span>
                      ) : (
                        <Badge
                          variant={
                            disagreementLabel(row.disagreement).tone === "consensus"
                              ? "go"
                              : disagreementLabel(row.disagreement).tone === "split"
                                ? "goif"
                                : "nogo"
                          }
                        >
                          {row.disagreement}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-navy-400">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
