import Link from "next/link";
import { Activity, ArrowUpRight, Gauge, Scale, Sparkles, Swords } from "lucide-react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardTitle, MetricTile } from "@/components/ui/card";
import { FLASH_MODEL, PRO_MODEL, SCORE_DIMENSIONS } from "@/lib/agents/meta";
import { quotaStatus } from "@/lib/analysis";
import { verdictHeadline, verdictLabel, verdictVariant } from "@/lib/constants";
import type { ChairOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { providerStatus } from "@/lib/llm";
import {
  listOfflineAnalyses,
  offlineAggregate,
  offlineDimensionAverages,
  offlineLatest,
} from "@/lib/offline-analyses";
import { disagreementLabel } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const metadata = { title: "Panel · PitchArena" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "sırada",
  RUNNING: "çalışıyor",
  COMPLETED: "tamamlandı",
  FAILED: "başarısız",
};

export default async function DashboardPage() {
  const [latestResult, recentResult, aggregateResult, dimensionAveragesResult, runningCountResult] =
    await Promise.allSettled([
      prisma.analysis.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        include: { runs: { where: { agentKey: "chair" }, select: { rawJson: true } } },
      }),
      prisma.analysis.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          status: true,
          verdict: true,
          overallScore: true,
          createdAt: true,
        },
      }),
      prisma.analysis.aggregate({
        where: { status: "COMPLETED" },
        _avg: { overallScore: true, disagreement: true },
        _count: { _all: true },
      }),
      prisma.score.groupBy({ by: ["dimension"], _avg: { value: true } }),
      prisma.analysis.count({ where: { status: "RUNNING" } }),
    ]);
  const quota = await quotaStatus();

  const dbLatest = latestResult.status === "fulfilled" ? latestResult.value : null;
  const dbRecent = recentResult.status === "fulfilled" ? recentResult.value : [];
  const dbAggregate =
    aggregateResult.status === "fulfilled"
      ? aggregateResult.value
      : { _avg: { overallScore: null, disagreement: null }, _count: { _all: 0 } };
  const dbDimensionAverages =
    dimensionAveragesResult.status === "fulfilled" ? dimensionAveragesResult.value : [];
  const runningCount = runningCountResult.status === "fulfilled" ? runningCountResult.value : 0;

  // DB kapalıyken panel boş kalmasın: kullanıcının bu oturumda ürettiği
  // çevrimdışı analizler aynı kartları besler.
  const offline = dbAggregate._count._all === 0;
  const latest = dbLatest ?? (offline ? offlineLatest() : null);
  const recent = dbRecent.length ? dbRecent : offline ? listOfflineAnalyses(6).map((r) => r.analysis) : [];
  const aggregate = offline ? offlineAggregate() : dbAggregate;
  const dimensionAverages = offline ? offlineDimensionAverages() : dbDimensionAverages;

  const chair = latest?.runs[0]?.rawJson as ChairOutput | null;
  const total = aggregate._count._all;
  const provider = providerStatus();
  const simulationMode = provider.id === "simulation";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-electric-600 uppercase">Command center</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy-900">Yatırım kararları, netleşti.</h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-navy-500">Her fikir, karşıt görüşler ve somut risklerle test edilir. Gürültüyü değil, karar sinyalini gör.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* --- Son komite kararı --- */}
        <Card className="hero-panel overflow-hidden border-0 text-white">
          <CardBody className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="live">SON KARAR</Badge>
                {runningCount > 0 && <LiveDot label={`${runningCount} analiz çalışıyor`} />}
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-electric-200 backdrop-blur-sm">
                <Scale className="size-[18px]" aria-hidden />
              </span>
            </div>

            {latest ? (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "rounded-xl px-3 py-1 text-base font-bold",
                      verdictVariant(latest.verdict) === "go" && "bg-verdict-go/10 text-verdict-go",
                      verdictVariant(latest.verdict) === "goif" &&
                        "bg-verdict-goif/10 text-verdict-goif",
                      verdictVariant(latest.verdict) === "nogo" &&
                        "bg-verdict-nogo/10 text-verdict-nogo",
                    )}
                  >
                    {verdictLabel(latest.verdict)}
                  </span>
                  <span className="text-[13px] text-navy-500">
                    {verdictHeadline(latest.verdict)}
                  </span>
                </div>

                <h2 className="mt-3 max-w-2xl text-2xl leading-snug font-bold text-white sm:text-3xl">
                  {chair?.oneLiner ?? latest.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-200">
                  {latest.title}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <MetricTile label="Genel puan" icon={<Gauge className="size-4" />}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-navy-900">
                        {latest.overallScore}
                      </span>
                      <span className="text-xs text-navy-400">/ 100</span>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-navy-100">
                      <div
                        className="h-full rounded-full bg-electric-500"
                        style={{ width: `${latest.overallScore ?? 0}%` }}
                      />
                    </div>
                  </MetricTile>

                  <MetricTile label="Anlaşmazlık endeksi" icon={<Swords className="size-4" />}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-navy-900">
                        {latest.disagreement}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] text-navy-400">
                      {latest.disagreement !== null
                        ? disagreementLabel(latest.disagreement).label
                        : "—"}
                    </p>
                  </MetricTile>

                  <MetricTile label="Bugünkü kota" icon={<Activity className="size-4" />}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-navy-900">{quota.remaining}</span>
                      <span className="text-xs text-navy-400">/ {quota.limit}</span>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-navy-100">
                      <div
                        className="h-full rounded-full bg-electric-500"
                        style={{ width: `${(quota.remaining / quota.limit) * 100}%` }}
                      />
                    </div>
                  </MetricTile>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href={`/analysis/${latest.id}`} variant="primary" size="sm">
                    Tutanağı aç
                    <ArrowUpRight className="size-4" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href="/analysis" variant="secondary" size="sm">
                    Yeni fikir gönder
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-5 max-w-lg text-3xl font-bold text-white">
                  Henüz bir komite toplanmadı
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-navy-200">
                  Fikrini gönder; 11 ajan dört turda tartışsın. Biri fikri öldürmeye, biri
                  savunmaya çalışacak, üç yatırımcı ayrı ayrı karar verecek.
                </p>
                <ButtonLink href="/analysis" variant="primary" className="mt-6">
                  İlk analizi başlat
                  <ArrowUpRight className="size-4" aria-hidden />
                </ButtonLink>
              </>
            )}
          </CardBody>
        </Card>

        {/* --- Son analizler --- */}
        <Card className="flex flex-col">
          <CardBody className="flex items-start justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-electric-500" aria-hidden />
              Son analizler
            </CardTitle>
            <Badge variant="outline" className="shrink-0">
              {total} tamamlandı
            </Badge>
          </CardBody>

          {recent.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-navy-400">Kayıt yok.</p>
          ) : (
            <ul className="scrollbar-slim flex-1 space-y-1 overflow-y-auto px-5 pb-5">
              {recent.map((analysis) => (
                <li
                  key={analysis.id}
                  className={cn(
                    "border-l-2 py-3 pl-3",
                    analysis.status === "RUNNING"
                      ? "border-electric-500"
                      : "border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    {analysis.verdict ? (
                      <Badge variant={verdictVariant(analysis.verdict)}>
                        {verdictLabel(analysis.verdict)}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">{STATUS_LABEL[analysis.status]}</Badge>
                    )}
                    <span className="text-[11px] text-navy-400">
                      {analysis.createdAt.toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <Link
                    href={`/analysis/${analysis.id}`}
                    className="mt-2 block text-[13px] leading-snug font-semibold text-navy-900 hover:text-electric-600"
                  >
                    {analysis.title}
                  </Link>
                  {analysis.overallScore !== null && (
                    <p className="mt-1 text-[12px] text-navy-400">
                      Genel puan {analysis.overallScore}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* --- Boyut ortalamaları + sistem durumu --- */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardBody>
            <CardTitle className="text-lg">Boyut ortalamaları</CardTitle>
            <p className="mt-1 text-[13px] text-navy-500">
              Tüm analizler boyunca fikirlerin hangi eksende zayıf kaldığı.
            </p>
            <ul className="mt-5 space-y-4">
              {SCORE_DIMENSIONS.map((dimension) => {
                const value = dimensionAverages.find(
                  (d) => d.dimension === dimension.dimension,
                )?._avg.value;
                return (
                  <li key={dimension.dimension}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-navy-800">
                        {dimension.dimension}
                      </span>
                      <span className="text-[13px] font-semibold text-navy-900">
                        {value?.toFixed(0) ?? "—"}
                        <span className="ml-2 text-[11px] font-medium text-navy-400">
                          ağırlık %{Math.round(dimension.weight * 100)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
                      <div
                        style={{ width: `${value ?? 0}%` }}
                        className="h-full rounded-full bg-electric-500"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle className="text-lg">Sistem durumu</CardTitle>
            <dl className="mt-4 space-y-3 text-[13px]">
              <Row label="LLM sağlayıcısı">
                {simulationMode ? (
                  <Badge variant="goif">Simülasyon</Badge>
                ) : (
                  <Badge variant="go">Gemini</Badge>
                )}
              </Row>
              <Row label="Tur 1-3 modeli">
                <span className="font-mono text-[12px] text-navy-600">{FLASH_MODEL}</span>
              </Row>
              <Row label="Sentez modeli">
                <span className="font-mono text-[12px] text-navy-600">{PRO_MODEL}</span>
              </Row>
              <Row label="Ortalama puan">
                <span className="font-semibold text-navy-900">
                  {aggregate._avg.overallScore?.toFixed(0) ?? "—"}
                </span>
              </Row>
              <Row label="Ortalama anlaşmazlık">
                <span className="font-semibold text-navy-900">
                  {aggregate._avg.disagreement?.toFixed(0) ?? "—"}
                </span>
              </Row>
            </dl>

            {provider.reason !== "ok" && (
              <p className="mt-4 rounded-lg bg-verdict-goif/10 px-3 py-2 text-[11px] leading-relaxed text-navy-600">
                {provider.reason === "no-key" ? (
                  <>
                    <code className="text-[10px]">GEMINI_API_KEY</code> tanımlı değil. Hat uçtan
                    uca çalışır ancak ajan metinleri şablon tabanlıdır.
                  </>
                ) : (
                  <>
                    <code className="text-[10px]">GEMINI_API_KEY</code> boşluk içeriyor, bu haliyle
                    kullanılamaz. Ayrıntı için Ayarlar ekranına bakın.
                  </>
                )}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-navy-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
