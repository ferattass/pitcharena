import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { IdeaForm } from "@/components/analysis/idea-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ROUND_AGENTS, ROUND_LABELS, ROUND_SUBTITLES } from "@/lib/agents/meta";
import { AGENT_META } from "@/lib/agents/meta";
import { quotaStatus } from "@/lib/analysis";
import { verdictLabel, verdictVariant } from "@/lib/constants";
import { listOfflineAnalyses } from "@/lib/offline-analyses";
import { prisma } from "@/lib/db";

export const metadata = { title: "Yeni analiz · PitchArena" };
export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const [recentResult] = await Promise.allSettled([
    prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, verdict: true, overallScore: true },
    }),
  ]);
  const recent = recentResult.status === "fulfilled" ? recentResult.value : [];
  const offlineRecent = recent.length ? [] : listOfflineAnalyses(5).map((record) => record.analysis);
  const visibleRecent = recent.length ? recent : offlineRecent;
  const quota = await quotaStatus();

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Fikrini savunmak zorunda kalacaksın</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-navy-500">
          Fikrini 11 ajandan oluşan bir yatırım komitesine gönder. Biri onu öldürmeye, biri
          savunmaya çalışacak; üç yatırımcı ayrı ayrı karar verecek ve komite başkanı
          anlaşmazlığı tutanağa geçirecek.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <IdeaForm />

        <div className="space-y-5">
          <Card>
            <CardBody className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Bugünkü kota</h2>
                <Badge variant="outline">Ücretsiz katman</Badge>
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-navy-900">{quota.remaining}</span>
                <span className="text-[12px] text-navy-400">/ {quota.limit} analiz kaldı</span>
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-navy-100">
                <div
                  className="h-full rounded-full bg-electric-500"
                  style={{ width: `${(quota.remaining / quota.limit) * 100}%` }}
                />
              </div>
            </CardBody>
          </Card>

          {visibleRecent.length > 0 ? (
            <Card>
              <CardBody className="p-5">
                <h2 className="text-sm font-semibold">Son analizler</h2>
                <ul className="mt-3 space-y-2">
                  {visibleRecent.map((analysis) => (
                    <li key={analysis.id}>
                      <Link
                        href={`/analysis/${analysis.id}`}
                        className="group flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-navy-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-navy-800">
                            {analysis.title}
                          </span>
                          <span className="text-[11px] text-navy-400">
                            {analysis.status === "COMPLETED"
                              ? `Puan ${analysis.overallScore}`
                              : analysis.status === "FAILED"
                                ? "Başarısız"
                                : "Çalışıyor…"}
                          </span>
                        </span>
                        {analysis.verdict ? (
                          <Badge variant={verdictVariant(analysis.verdict)}>
                            {verdictLabel(analysis.verdict)}
                          </Badge>
                        ) : (
                          <ArrowUpRight className="size-3.5 shrink-0 text-navy-300" aria-hidden />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="p-5">
                <h2 className="text-sm font-semibold">Son analizler</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-navy-500">
                  Henüz kayıtlı analiz yok ya da veritabanına erişilemiyor.
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <RoundExplainer />
    </div>
  );
}

/** Ürünün nasıl çalıştığını fikir girilmeden önce anlatır. */
function RoundExplainer() {
  return (
    <Card>
      <CardBody className="p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-electric-500" aria-hidden />
          <h2 className="text-base font-semibold">Analiz nasıl işliyor?</h2>
        </div>

        <ol className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([1, 2, 3, 4] as const).map((round) => (
            <li key={round} className="rounded-xl border border-hairline p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-md bg-navy-100 text-[11px] font-bold text-navy-600">
                  {round}
                </span>
                <span className="text-[13px] font-semibold text-navy-900">
                  {ROUND_LABELS[round]}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-navy-500">
                {ROUND_SUBTITLES[round]}
              </p>
              <ul className="mt-3 space-y-1">
                {ROUND_AGENTS[round].map((key) => (
                  <li key={key} className="text-[12px] text-navy-600">
                    <span className="font-medium">{AGENT_META[key].name}</span>
                    <span className="text-navy-400"> — {AGENT_META[key].incentive}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
