import { FlaskConical, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { INVESTOR_KEYS } from "@/lib/agents/meta";
import type { AnalysisView } from "@/lib/analysis-view";
import { AgentCard } from "./agent-card";
import { Committee } from "./committee";
import { Debate } from "./debate";
import { RoundSection } from "./round-section";
import { VerdictPanel } from "./verdict-panel";

/**
 * Tamamlanmış analizin raporu. Sıralama bilinçli: önce karar, sonra
 * anlaşmazlık, sonra tartışma, en sonda ham bulgular. Jüri ilk ekranda
 * kararı ve muhalefeti görmeli.
 */
export function Report({ view }: { view: AnalysisView }) {
  return (
    <div className="space-y-5">
      {view.simulated && <SimulationNotice />}
      <VerdictPanel view={view} />
      <Committee view={view} />
      <Debate view={view} />

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Users className="size-4 text-navy-400" aria-hidden />
          Yatırımcı simülasyonu
        </h3>
        <p className="mt-1 text-[12px] text-navy-500">
          Aynı fikre üç farklı yatırım teziyle bakıldı. Ayrışma bir hata değil, bulgudur.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {INVESTOR_KEYS.map((key) => (
            <AgentCard key={key} agent={view.agents[key]} defaultOpen />
          ))}
        </div>
      </section>

      <RoundSection view={view} round={1} defaultOpen={false} />
    </div>
  );
}

/**
 * Simülasyon sağlayıcısıyla üretilen analizler açıkça işaretlenir.
 * Kullanıcı bu metnin gerçek bir model muhakemesi olmadığını bilmeli.
 */
export function SimulationNotice() {
  return (
    <Card className="border-verdict-goif/30 bg-verdict-goif/5">
      <CardBody className="flex items-start gap-3 p-4">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-verdict-goif" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-navy-900">
            Bu analiz simülasyon modunda üretildi
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-navy-600">
            <code className="rounded bg-navy-100 px-1 py-0.5 text-[11px]">GEMINI_API_KEY</code>{" "}
            tanımlı olmadığı için ajanlar gerçek modele değil şablon tabanlı bir sağlayıcıya
            bağlandı. Orkestrasyon, skorlama ve akışın tamamı gerçektir; metinler fikre özel
            muhakeme içermez.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
