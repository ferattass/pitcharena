import { Shield, Swords } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import type { AdvocateOutput, SkepticOutput } from "@/lib/agents/schemas";
import type { AnalysisView } from "@/lib/analysis-view";
import { severityLabel, strategyLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Ürünün kalbi: saldırı ve cevabı yan yana koyar.
 *
 * Eşleştirme `attackTitle` üzerinden yapılır — avukat ajanına saldırı
 * başlığını birebir tekrarlaması söylenir. Eşleşme tutmazsa cevap yine de
 * sırayla gösterilir; tartışma hiçbir durumda kaybolmaz.
 */
export function Debate({ view }: { view: AnalysisView }) {
  const skeptic = view.agents.skeptic.output as SkepticOutput | null;
  const advocate = view.agents.advocate.output as AdvocateOutput | null;

  if (!skeptic) return null;

  const used = new Set<number>();
  const pairs = skeptic.attacks.map((attack, index) => {
    const rebuttals = advocate?.rebuttals ?? [];
    let match = rebuttals.findIndex(
      (rebuttal, i) => !used.has(i) && normalize(rebuttal.attackTitle) === normalize(attack.title),
    );
    if (match === -1 && rebuttals[index] && !used.has(index)) match = index;
    if (match !== -1) used.add(match);

    return { attack, rebuttal: match === -1 ? null : rebuttals[match] };
  });

  return (
    <Card>
      <CardBody className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Çapraz sorgu</h3>
            <p className="mt-0.5 text-[13px] text-navy-500">
              Şüpheci Yatırımcı saldırır, Kurucu Avukatı cevaplar. Aynı fikir, zıt teşvikler.
            </p>
          </div>
          <p className="text-[12px] text-navy-400">{pairs.length} saldırı</p>
        </div>

        <div className="mt-5 rounded-xl bg-verdict-nogo/5 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-verdict-nogo">
            BU FİKİR NEDEN 18 AYDA ÖLÜR?
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-navy-800">{skeptic.thesis}</p>
        </div>

        <ol className="mt-4 space-y-3">
          {pairs.map(({ attack, rebuttal }, index) => (
            <li key={index} className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-verdict-nogo/20 bg-verdict-nogo/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-verdict-nogo">
                    <Swords className="size-3.5" aria-hidden />
                    SALDIRI
                  </span>
                  <span className="text-[11px] font-medium text-navy-400">
                    {severityLabel(attack.severity)}
                  </span>
                </div>
                <p className="mt-2 text-[14px] font-semibold text-navy-900">{attack.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-navy-600">{attack.argument}</p>
              </div>

              {rebuttal ? (
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    rebuttal.strategy === "CONCEDE"
                      ? "border-hairline bg-surface"
                      : "border-verdict-go/20 bg-verdict-go/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                        rebuttal.strategy === "CONCEDE" ? "text-navy-500" : "text-verdict-go",
                      )}
                    >
                      <Shield className="size-3.5" aria-hidden />
                      SAVUNMA
                    </span>
                    <span className="text-[11px] font-medium text-navy-400">
                      {strategyLabel(rebuttal.strategy)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-navy-700">
                    {rebuttal.response}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-hairline p-4">
                  <p className="text-[12px] text-navy-400">Bu saldırıya cevap verilmedi.</p>
                </div>
              )}
            </li>
          ))}
        </ol>

        {advocate?.proposedPivot && (
          <div className="mt-4 rounded-xl bg-electric-50 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-electric-700">
              AVUKATIN ÖNERDİĞİ PİVOT
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-navy-800">
              {advocate.proposedPivot}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}
