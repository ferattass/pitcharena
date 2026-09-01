import Link from "next/link";
import { CalendarDays, GitBranch, PlayCircle, RotateCcw } from "lucide-react";
import { LiveAnalysis } from "@/components/analysis/live-analysis";
import { InvestmentWorkspace } from "@/components/analysis/investment-workspace";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { viewFromRows } from "@/lib/analysis-view";
import { prisma } from "@/lib/db";
import { readDb } from "@/lib/db-errors";
import { findOfflineAnalysis } from "@/lib/offline-analyses";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/analysis/[id]">) {
  const { id } = await props.params;
  const offline = findOfflineAnalysis(id);
  if (offline) {
    return { title: `${offline.analysis.title} · PitchArena` };
  }

  const result = await readDb(prisma.analysis.findUnique({ where: { id }, select: { title: true } }), null);
  return { title: result.value ? `${result.value.title} · PitchArena` : "Analiz · PitchArena" };
}

export default async function AnalysisDetailPage(props: PageProps<"/analysis/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const replay = searchParams.replay === "1";

  const offline = findOfflineAnalysis(id);
  if (offline) {
    const analysis = offline.analysis;
    const view = viewFromRows({ analysis, runs: offline.runs, scores: offline.scores });

    return (
      <div className="mx-auto max-w-[1400px] space-y-5">
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {analysis.version > 1 && (
                    <Badge variant="outline">
                      <GitBranch className="size-3" aria-hidden />
                      v{analysis.version}
                    </Badge>
                  )}
                  <Badge variant="outline">ÇEVRİMDIŞI</Badge>
                  {analysis.simulated && <Badge variant="goif">SİMÜLASYON</Badge>}
                </div>
                <h1 className="mt-2 text-xl font-bold text-navy-900">{analysis.title}</h1>
                <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-navy-500">
                  {analysis.ideaText}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <LiveAnalysis initial={view} replay={false} />
        <InvestmentWorkspace
          analysisId={analysis.id}
          evidence={offline.evidence}
          challenges={offline.challenges}
          citationCount={offline.runs.reduce((total, run) => total + run.citations.length, 0)}
        />
      </div>
    );
  }

  const analysisResult = await readDb(
    prisma.analysis.findUnique({
      where: { id },
      include: {
        runs: { include: { citations: true } },
        scores: true,
        evidence: { orderBy: { createdAt: "asc" } },
        challenges: { orderBy: { createdAt: "asc" } },
        children: { select: { id: true, version: true }, orderBy: { version: "asc" } },
        parent: { select: { id: true, version: true, overallScore: true } },
      },
    }),
    null,
  );

  if (!analysisResult.value) {
    return (
      <div className="mx-auto max-w-[900px]">
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-sm font-medium text-navy-700">
              {analysisResult.unavailable
                ? "Veritabanına erişilemiyor"
                : "Analiz bulunamadı"}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-navy-500">
              {analysisResult.unavailable
                ? "Bu analiz kaydı şu anda yüklenemiyor. Bağlantı geri geldiğinde sayfa tekrar açılabilir."
                : "Geçerli bir analiz ID’siyle tekrar deneyin."}
            </p>
            <ButtonLink href="/dashboard" variant="primary" className="mt-5">
              Panele dön
            </ButtonLink>
          </CardBody>
        </Card>
      </div>
    );
  }

  const analysis = analysisResult.value;

  const view = viewFromRows({ analysis, runs: analysis.runs, scores: analysis.scores });
  const finished = analysis.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {analysis.version > 1 && (
                  <Badge variant="outline">
                    <GitBranch className="size-3" aria-hidden />v{analysis.version}
                  </Badge>
                )}
                {analysis.simulated && <Badge variant="goif">SİMÜLASYON</Badge>}
                <span className="inline-flex items-center gap-1.5 text-[11px] text-navy-400">
                  <CalendarDays className="size-3" aria-hidden />
                  {analysis.createdAt.toLocaleString("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              <h1 className="mt-2 text-xl font-bold text-navy-900">{analysis.title}</h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-navy-500">
                {analysis.ideaText}
              </p>
            </div>

            {finished && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <ButtonLink href={`/analysis/${id}?replay=1`} size="sm" variant="secondary">
                  <PlayCircle className="size-4" aria-hidden />
                  Tekrar oynat
                </ButtonLink>
                <ButtonLink href={`/analysis/${id}/revise`} size="sm" variant="primary">
                  <RotateCcw className="size-4" aria-hidden />
                  Fikri revize et
                </ButtonLink>
              </div>
            )}
          </div>

          {(analysis.parent || analysis.children.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
              <span className="text-[11px] font-semibold tracking-wide text-navy-400">
                VERSİYON ZİNCİRİ
              </span>
              {analysis.parent && (
                <Link
                  href={`/analysis/${analysis.parent.id}`}
                  className="rounded-lg bg-navy-50 px-2.5 py-1 text-[12px] text-navy-600 hover:text-navy-900"
                >
                  v{analysis.parent.version}
                  {analysis.parent.overallScore !== null && ` · ${analysis.parent.overallScore} puan`}
                </Link>
              )}
              <span className="rounded-lg bg-electric-100 px-2.5 py-1 text-[12px] font-semibold text-electric-700">
                v{analysis.version}
                {analysis.overallScore !== null && ` · ${analysis.overallScore} puan`}
              </span>
              {analysis.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/analysis/${child.id}`}
                  className="rounded-lg bg-navy-50 px-2.5 py-1 text-[12px] text-navy-600 hover:text-navy-900"
                >
                  v{child.version}
                </Link>
              ))}
              {analysis.parent && analysis.parent.overallScore !== null && analysis.overallScore !== null && (
                <span className={analysis.overallScore >= analysis.parent.overallScore ? "ml-auto rounded-lg bg-verdict-go/10 px-2.5 py-1 text-[12px] font-semibold text-verdict-go" : "ml-auto rounded-lg bg-verdict-nogo/10 px-2.5 py-1 text-[12px] font-semibold text-verdict-nogo"}>
                  {analysis.overallScore >= analysis.parent.overallScore ? "+" : ""}{analysis.overallScore - analysis.parent.overallScore} puan · v{analysis.version - 1}&rarr;v{analysis.version}
                </span>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <LiveAnalysis initial={view} replay={replay} />
      {finished && !replay && (
        <InvestmentWorkspace
          analysisId={analysis.id}
          evidence={analysis.evidence}
          challenges={analysis.challenges}
          citationCount={analysis.runs.reduce((total, run) => total + run.citations.length, 0)}
        />
      )}
    </div>
  );
}
