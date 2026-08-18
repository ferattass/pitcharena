import Link from "next/link";
import { FileText, GitBranch, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { verdictLabel, verdictVariant } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { disagreementLabel } from "@/lib/scoring";

export const metadata = { title: "Kayıtlı raporlar · PitchArena" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Sırada",
  RUNNING: "Çalışıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
};

export default async function ReportsPage(props: PageProps<"/reports">) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  const analyses = await prisma.analysis.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { ideaText: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      verdict: true,
      overallScore: true,
      disagreement: true,
      simulated: true,
      version: true,
      parentId: true,
      createdAt: true,
      _count: { select: { runs: true } },
    },
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Kayıtlı raporlar</h1>
          <p className="mt-1.5 text-sm text-navy-500">
            {query
              ? `"${query}" için ${analyses.length} sonuç.`
              : "Her analiz tam olarak tekrar oynatılabilir — olaylar kayıtlı tutulur."}
          </p>
        </div>
        <ButtonLink href="/analysis" variant="primary">
          Yeni analiz
        </ButtonLink>
      </div>

      {analyses.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <FileText className="mx-auto size-8 text-navy-200" aria-hidden />
            <p className="mt-3 text-sm font-medium text-navy-700">
              {query ? "Eşleşen rapor yok" : "Henüz rapor yok"}
            </p>
            <p className="mt-1 text-[13px] text-navy-500">
              {query
                ? "Farklı bir arama deneyin."
                : "İlk fikrini gönder, komite toplansın."}
            </p>
            <ButtonLink href="/analysis" variant="primary" className="mt-5">
              Fikir gönder
            </ButtonLink>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface">
                  <Th>Fikir</Th>
                  <Th>Durum</Th>
                  <Th>Karar</Th>
                  <Th>Puan</Th>
                  <Th>Anlaşmazlık</Th>
                  <Th>Tarih</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/analysis/${analysis.id}`}
                        className="text-[13px] font-medium text-navy-900 hover:text-electric-600"
                      >
                        {analysis.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {analysis.version > 1 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-navy-400">
                            <GitBranch className="size-3" aria-hidden />v{analysis.version}
                          </span>
                        )}
                        {analysis.simulated && (
                          <span className="text-[11px] text-verdict-goif">simülasyon</span>
                        )}
                        <span className="text-[11px] text-navy-400">
                          {analysis._count.runs} ajan
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-navy-500">
                      {STATUS_LABEL[analysis.status] ?? analysis.status}
                    </td>
                    <td className="px-4 py-3">
                      {analysis.verdict ? (
                        <Badge variant={verdictVariant(analysis.verdict)}>
                          {verdictLabel(analysis.verdict)}
                        </Badge>
                      ) : (
                        <span className="text-[12px] text-navy-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold text-navy-900">
                        {analysis.overallScore ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {analysis.disagreement === null ? (
                        <span className="text-[12px] text-navy-300">—</span>
                      ) : (
                        <span className="text-[12px] text-navy-600">
                          {analysis.disagreement} · {disagreementLabel(analysis.disagreement).label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap text-navy-400">
                      {analysis.createdAt.toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {analysis.status === "COMPLETED" && (
                        <Link
                          href={`/analysis/${analysis.id}?replay=1`}
                          className="inline-flex items-center gap-1 text-[12px] text-navy-400 hover:text-electric-600"
                          title="Analizi baştan oynat"
                        >
                          <PlayCircle className="size-3.5" aria-hidden />
                          oynat
                        </Link>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-navy-400">{children}</th>
  );
}
