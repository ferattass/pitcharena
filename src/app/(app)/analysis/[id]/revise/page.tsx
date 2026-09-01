import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IdeaForm } from "@/components/analysis/idea-form";
import { Card, CardBody } from "@/components/ui/card";
import type { ChairOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { readDb } from "@/lib/db-errors";
import { findOfflineAnalysis } from "@/lib/offline-analyses";

export const metadata = { title: "Fikri revize et · PitchArena" };
export const dynamic = "force-dynamic";

/**
 * Versiyonlama ekranı: komitenin kararı değiştirecek dediği üç şeyi
 * gösterir, kullanıcı fikri ona göre düzeltir ve v2 çalışır. Skor farkı
 * analiz sayfasındaki versiyon zincirinde görünür.
 */
export default async function RevisePage(props: PageProps<"/analysis/[id]/revise">) {
  const { id } = await props.params;

  const offline = findOfflineAnalysis(id);
  if (offline) {
    const analysis = offline.analysis;
    const chair = offline.runs.find((run) => run.agentKey === "chair")?.rawJson as ChairOutput | null;

    return (
      <div className="mx-auto max-w-[900px] space-y-5">
        <Link
          href={`/analysis/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-navy-500 hover:text-navy-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Analize dön
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-navy-900">Fikri revize et</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-500">
            Aşağıdaki metni komitenin itirazlarına göre düzelt ve tekrar çalıştır. Yeni analiz
            v{analysis.version + 1} olarak kaydedilir; iki versiyonun puanını yan yana görebilirsin.
          </p>
        </div>

        {chair && (
          <Card className="border-electric-200 bg-electric-50">
            <CardBody className="p-5">
              <p className="text-[11px] font-semibold tracking-wide text-electric-700">
                KOMİTENİN KARARINI DEĞİŞTİRECEK ŞEYLER
              </p>
              <ol className="mt-2.5 space-y-2">
                {chair.changeMyMind.map((entry, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-navy-800">
                    <strong>{index + 1}.</strong> {entry.item}
                    <span className="block text-[12px] text-navy-500">{entry.why}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        )}

        <IdeaForm parentId={id} initialText={analysis.ideaText} />
      </div>
    );
  }

  const analysisResult = await readDb(
    prisma.analysis.findUnique({
      where: { id },
      include: { runs: { where: { agentKey: "chair" }, select: { rawJson: true } } },
    }),
    null,
  );

  if (!analysisResult.value) {
    return (
      <div className="mx-auto max-w-[900px] space-y-5">
        <Link
          href="/analysis"
          className="inline-flex items-center gap-1.5 text-[13px] text-navy-500 hover:text-navy-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Analize dön
        </Link>
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-sm font-medium text-navy-700">
              {analysisResult.unavailable
                ? "Veritabanına erişilemiyor"
                : "Analiz bulunamadı"}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-navy-500">
              {analysisResult.unavailable
                ? "Revize ekranı, veri bağlantısı geri geldiğinde yeniden kullanılabilir."
                : "Geçerli bir analiz ID’siyle tekrar deneyin."}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const analysis = analysisResult.value;

  const chair = analysis.runs[0]?.rawJson as ChairOutput | null;

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <Link
        href={`/analysis/${id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-500 hover:text-navy-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Analize dön
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-navy-900">Fikri revize et</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-navy-500">
          Aşağıdaki metni komitenin itirazlarına göre düzelt ve tekrar çalıştır. Yeni analiz
          v{analysis.version + 1} olarak kaydedilir; iki versiyonun puanını yan yana görebilirsin.
        </p>
      </div>

      {chair && (
        <Card className="border-electric-200 bg-electric-50">
          <CardBody className="p-5">
            <p className="text-[11px] font-semibold tracking-wide text-electric-700">
              KOMİTENİN KARARINI DEĞİŞTİRECEK ŞEYLER
            </p>
            <ol className="mt-2.5 space-y-2">
              {chair.changeMyMind.map((entry, index) => (
                <li key={index} className="text-[13px] leading-relaxed text-navy-800">
                  <strong>{index + 1}.</strong> {entry.item}
                  <span className="block text-[12px] text-navy-500">{entry.why}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}

      <IdeaForm parentId={id} initialText={analysis.ideaText} />
    </div>
  );
}
