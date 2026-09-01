import { Activity, Swords, TrendingUp } from "lucide-react";
import { Card, CardBody, MetricTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { AGENT_META, SCORE_DIMENSIONS, type AgentKey } from "@/lib/agents/meta";
import type { RiskOutput, SkepticOutput } from "@/lib/agents/schemas";
import { verdictLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { readDb } from "@/lib/db-errors";
import {
  offlineAgentRuns,
  offlineAggregate,
  offlineDimensionAverages,
  offlineVerdictGroups,
} from "@/lib/offline-analyses";

export const metadata = { title: "Pazar eğilimleri · PitchArena" };
export const dynamic = "force-dynamic";

/**
 * Tek analiz değil, biriken analizlerin örüntüsü.
 *
 * Bütün sayılar bu kurulumdaki gerçek analizlerden hesaplanır — sabit
 * demo verisi yoktur. Analiz yoksa ekran bunu açıkça söyler.
 */
export default async function TrendsPage() {
  const [verdictGroupsResult, dimensionAveragesResult, aggregateResult, skepticRunsResult, riskRunsResult] =
    await Promise.all([
      readDb(
        prisma.analysis.groupBy({
          by: ["verdict"],
          where: { status: "COMPLETED" },
          _count: { _all: true },
        }),
        [],
      ),
      readDb(
        prisma.score.groupBy({
          by: ["dimension"],
          _avg: { value: true },
          _count: { _all: true },
        }),
        [],
      ),
      readDb(
        prisma.analysis.aggregate({
          where: { status: "COMPLETED" },
          _avg: { overallScore: true, disagreement: true },
          _count: { _all: true },
        }),
        { _avg: { overallScore: null, disagreement: null }, _count: { _all: 0 } },
      ),
      readDb(
        prisma.agentRun.findMany({
          where: { agentKey: "skeptic", status: "COMPLETED" },
          select: { rawJson: true },
          take: 200,
        }),
        [],
      ),
      readDb(
        prisma.agentRun.findMany({
          where: { agentKey: "risk", status: "COMPLETED" },
          select: { rawJson: true },
          take: 200,
        }),
        [],
      ),
    ]);

  // DB'den hiç analiz gelmediyse eğilimleri çevrimdışı kayıtlardan hesapla —
  // aksi halde kullanıcı kendi ürettiği analizleri bu ekranda hiç göremiyor.
  const offline = aggregateResult.value._count._all === 0;

  const verdictGroups = offline ? offlineVerdictGroups() : verdictGroupsResult.value;
  const dimensionAverages = offline ? offlineDimensionAverages() : dimensionAveragesResult.value;
  const aggregate = offline ? offlineAggregate() : aggregateResult.value;
  const skepticRuns = offline ? offlineAgentRuns("skeptic") : skepticRunsResult.value;
  const riskRuns = offline ? offlineAgentRuns("risk") : riskRunsResult.value;

  const total = aggregate._count._all;

  // Şüpheci ajanın saldırıları hangi bulguyu hedefliyor? En çok saldırılan
  // boyut, fikirlerin ortak zayıf noktasını gösterir.
  const attackTargets = new Map<string, number>();
  for (const run of skepticRuns) {
    const output = run.rawJson as SkepticOutput | null;
    for (const attack of output?.attacks ?? []) {
      const key = attack.targetAgent?.trim().toLowerCase() ?? "";
      if (!key) continue;
      attackTargets.set(key, (attackTargets.get(key) ?? 0) + 1);
    }
  }

  const riskCategories = new Map<string, number>();
  for (const run of riskRuns) {
    const output = run.rawJson as RiskOutput | null;
    for (const risk of output?.risks ?? []) {
      const key = risk.category?.trim() ?? "";
      if (!key) continue;
      riskCategories.set(key, (riskCategories.get(key) ?? 0) + 1);
    }
  }

  if (total === 0) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <Card>
          <CardBody className="p-10 text-center">
            <TrendingUp className="mx-auto size-8 text-navy-200" aria-hidden />
            <p className="mt-3 text-sm font-medium text-navy-700">Henüz eğilim yok</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-navy-500">
              Bu ekran biriken analizlerden hesaplanır. En az bir analiz tamamlandığında
              boyut ortalamaları, karar dağılımı ve en çok saldırılan zayıf halka burada
              görünür.
            </p>
            <ButtonLink href="/analysis" variant="primary" className="mt-5">
              İlk analizi çalıştır
            </ButtonLink>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Pazar eğilimleri</h1>
        <p className="mt-1.5 text-sm text-navy-500">
          {total} tamamlanmış analizden hesaplandı.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Tamamlanan analiz" icon={<Activity className="size-4" />}>
          <p className="text-2xl font-bold text-navy-900">{total}</p>
        </MetricTile>
        <MetricTile label="Ortalama genel puan" icon={<TrendingUp className="size-4" />}>
          <p className="text-2xl font-bold text-navy-900">
            {aggregate._avg.overallScore?.toFixed(0) ?? "—"}
          </p>
        </MetricTile>
        <MetricTile label="Ortalama anlaşmazlık" icon={<Swords className="size-4" />}>
          <p className="text-2xl font-bold text-navy-900">
            {aggregate._avg.disagreement?.toFixed(0) ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-navy-400">0 = fikir birliği, 100 = tam ayrışma</p>
        </MetricTile>
        <MetricTile label="Karar dağılımı">
          <ul className="space-y-1">
            {verdictGroups.map((group) => (
              <li key={String(group.verdict)} className="flex justify-between text-[12px]">
                <span className="text-navy-500">{verdictLabel(group.verdict)}</span>
                <span className="font-semibold text-navy-900">{group._count._all}</span>
              </li>
            ))}
          </ul>
        </MetricTile>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardBody className="p-5">
            <h2 className="text-sm font-semibold">Boyut ortalamaları</h2>
            <p className="mt-0.5 text-[12px] text-navy-500">
              Fikirler hangi boyutta sistematik olarak zayıf kalıyor?
            </p>
            <ul className="mt-4 space-y-3">
              {SCORE_DIMENSIONS.map((dimension) => {
                const row = dimensionAverages.find((d) => d.dimension === dimension.dimension);
                const value = row?._avg.value ?? 0;
                return (
                  <li key={dimension.dimension}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-medium text-navy-700">
                        {dimension.dimension}
                      </span>
                      <span className="text-[12px] font-semibold text-navy-900">
                        {value.toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                      <div
                        className="h-full rounded-full bg-electric-500"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardBody className="p-5">
              <h2 className="text-sm font-semibold">En çok saldırılan halka</h2>
              <p className="mt-0.5 text-[12px] text-navy-500">
                Şüpheci Yatırımcı saldırılarını hangi bulguya yöneltiyor?
              </p>
              <RankedList
                items={[...attackTargets.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([key, count]) => [
                    AGENT_META[key as AgentKey]?.name ?? key,
                    count,
                  ])}
                empty="Henüz saldırı verisi yok."
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5">
              <h2 className="text-sm font-semibold">En sık risk kategorileri</h2>
              <p className="mt-0.5 text-[12px] text-navy-500">
                Risk & Regülasyon ajanının tekrar tekrar işaretlediği alanlar.
              </p>
              <RankedList
                items={[...riskCategories.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)}
                empty="Henüz risk verisi yok."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RankedList({
  items,
  empty,
}: {
  items: Array<[string, number]>;
  empty: string;
}) {
  if (!items.length) {
    return <p className="mt-3 text-[12px] text-navy-400">{empty}</p>;
  }
  const max = Math.max(...items.map(([, count]) => count));

  return (
    <ul className="mt-3 space-y-2">
      {items.map(([label, count]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[12px] text-navy-700">{label}</span>
            <span className="text-[12px] font-semibold text-navy-900">{count}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full rounded-full bg-navy-400"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
