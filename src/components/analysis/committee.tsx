import { Gavel, MessageSquareWarning, RefreshCcw } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import type { ChairOutput } from "@/lib/agents/schemas";
import type { AnalysisView } from "@/lib/analysis-view";

/**
 * Komite tutanağı: memo, muhalefet şerhi ve kararı değiştirecek 3 şey.
 *
 * Muhalefet şerhi ürünün ayırt edici parçası — bu yüzden gizlenmiş bir
 * detay değil, memonun yanında eşit ağırlıkta gösterilir.
 */
export function Committee({ view }: { view: AnalysisView }) {
  const chair = view.agents.chair.output as ChairOutput | null;
  if (!chair) return null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardBody className="p-6">
          <div className="flex items-center gap-2">
            <Gavel className="size-4 text-navy-500" aria-hidden />
            <h3 className="text-base font-semibold">Yatırım memosu</h3>
          </div>

          <div className="mt-4 space-y-3.5">
            {chair.memo.split("\n\n").map((paragraph, index) => (
              <p key={index} className="text-[14px] leading-relaxed text-navy-600">
                {paragraph}
              </p>
            ))}
          </div>

          {chair.conditions.length > 0 && (
            <div className="mt-5 rounded-xl bg-verdict-goif/10 p-4">
              <p className="text-[11px] font-semibold tracking-wide text-verdict-goif">
                YATIRIM İÇİN KOŞULLAR
              </p>
              <ul className="mt-2 space-y-1.5">
                {chair.conditions.map((condition, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-navy-800">
                    {index + 1}. {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-navy-400">GÜÇLÜ YANLAR</p>
              <ul className="mt-2 space-y-1.5">
                {chair.strengths.map((item, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-navy-600">
                    + {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-navy-400">ZAYIF YANLAR</p>
              <ul className="mt-2 space-y-1.5">
                {chair.weaknesses.map((item, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-navy-600">
                    − {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-5">
        <Card className="border-navy-200">
          <CardBody className="p-5">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="size-4 text-navy-500" aria-hidden />
              <h3 className="text-sm font-semibold">Muhalefet şerhi</h3>
            </div>
            <p className="mt-3 border-l-2 border-navy-300 pl-3 text-[13px] leading-relaxed text-navy-700 italic">
              {chair.dissent}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
              Komite kararına karşı çıkan görüş, zayıflatılmadan tutanağa geçirilir.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5">
            <div className="flex items-center gap-2">
              <RefreshCcw className="size-4 text-electric-500" aria-hidden />
              <h3 className="text-sm font-semibold">Bu kararı değiştirecek 3 şey</h3>
            </div>
            <ol className="mt-3 space-y-3">
              {chair.changeMyMind.map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-electric-100 text-[11px] font-bold text-electric-700">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-navy-800">{entry.item}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-navy-500">
                      {entry.why}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
