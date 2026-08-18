import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, GitBranch, PlayCircle, RotateCcw } from "lucide-react";
import { LiveAnalysis } from "@/components/analysis/live-analysis";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { viewFromRows } from "@/lib/analysis-view";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/analysis/[id]">) {
  const { id } = await props.params;
  const analysis = await prisma.analysis.findUnique({ where: { id }, select: { title: true } });
  return { title: analysis ? `${analysis.title} · PitchArena` : "Analiz · PitchArena" };
}

export default async function AnalysisDetailPage(props: PageProps<"/analysis/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const replay = searchParams.replay === "1";

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      runs: { include: { citations: true } },
      scores: true,
      children: { select: { id: true, version: true }, orderBy: { version: "asc" } },
      parent: { select: { id: true, version: true, overallScore: true } },
    },
  });

  if (!analysis) notFound();

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
            </div>
          )}
        </CardBody>
      </Card>

      <LiveAnalysis initial={view} replay={replay} />
    </div>
  );
}
