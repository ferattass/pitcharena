import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentKey } from "@/lib/agents/meta";
import type {
  AdvocateOutput,
  BusinessOutput,
  ChairOutput,
  CompetitorOutput,
  FeasibilityOutput,
  InvestorOutput,
  MarketOutput,
  RiskOutput,
  SkepticOutput,
} from "@/lib/agents/schemas";
import { confidenceLabel, severityLabel, strategyLabel } from "@/lib/constants";
import type { AgentView } from "@/lib/analysis-view";
import { cn } from "@/lib/utils";

/**
 * Ajanların yapısal çıktısını okunur hale getirir.
 *
 * JSON'u ham göstermek kolay olurdu ama ürünün iddiası "bir özet değil, bir
 * tutanak" — o yüzden her ajanın çıktısı kendi diline uygun biçimde çizilir.
 */
export function AgentOutput({ agent }: { agent: AgentView }) {
  if (agent.status === "failed") {
    return (
      <p className="text-[13px] text-verdict-nogo">
        Bu ajan tamamlanamadı: {agent.error || "bilinmeyen hata"}
      </p>
    );
  }
  if (!agent.output) return null;

  return (
    <div className="space-y-4">
      {renderByKey(agent.key, agent.output)}
      {agent.citations.length > 0 && <Citations citations={agent.citations} />}
    </div>
  );
}

function renderByKey(key: AgentKey, output: unknown) {
  switch (key) {
    case "market":
      return <Market data={output as MarketOutput} />;
    case "competitor":
      return <Competitor data={output as CompetitorOutput} />;
    case "feasibility":
      return <Feasibility data={output as FeasibilityOutput} />;
    case "business":
      return <Business data={output as BusinessOutput} />;
    case "risk":
      return <Risk data={output as RiskOutput} />;
    case "skeptic":
      return <Skeptic data={output as SkepticOutput} />;
    case "advocate":
      return <Advocate data={output as AdvocateOutput} />;
    case "angel":
    case "seriesA":
    case "corporate":
      return <Investor data={output as InvestorOutput} />;
    case "chair":
      return <Chair data={output as ChairOutput} />;
  }
}

// ------------------------------------------------------------ ortak parçalar

function Headline({ text }: { text: string }) {
  return <p className="text-[15px] leading-relaxed font-medium text-navy-900">{text}</p>;
}

function Findings({ items }: { items: Array<{ label: string; detail: string }> }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="border-l-2 border-hairline pl-3">
          <p className="text-[13px] font-semibold text-navy-800">{item.label}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-navy-500">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] font-semibold tracking-wide text-navy-400">{label}</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-navy-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "muted" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <li
          key={index}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[12px]",
            tone === "neutral" ? "bg-navy-50 text-navy-700" : "bg-surface text-navy-400 line-through",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold tracking-wide text-navy-400">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ScoreLine({ score, rationale, confidence }: { score: number; rationale: string; confidence: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-surface px-3.5 py-2.5">
      <span className="text-lg font-bold text-navy-900">{score}</span>
      <span className="text-[11px] text-navy-400">/ 100</span>
      <Badge variant="outline">{confidenceLabel(confidence)}</Badge>
      <p className="w-full text-[12px] leading-relaxed text-navy-500 sm:w-auto sm:flex-1">{rationale}</p>
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-verdict-nogo/10 text-verdict-nogo",
  HIGH: "bg-verdict-nogo/10 text-verdict-nogo",
  MEDIUM: "bg-verdict-goif/10 text-verdict-goif",
  LOW: "bg-navy-100 text-navy-600",
};

function SeverityTag({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW,
      )}
    >
      {severityLabel(severity)}
    </span>
  );
}

function Citations({ citations }: { citations: AgentView["citations"] }) {
  return (
    <Section title="KAYNAKLAR">
      <ul className="space-y-1.5">
        {citations.map((citation) => (
          <li key={citation.url}>
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-[12px] text-electric-600 hover:underline"
            >
              <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
              {citation.title}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ------------------------------------------------------------ TUR 1

function Market({ data }: { data: MarketOutput }) {
  return (
    <>
      <Headline text={data.headline} />
      <Facts
        rows={[
          ["TAM", data.tam],
          ["SAM", data.sam],
          ["SOM", data.som],
          ["BÜYÜME", data.growthRate],
        ]}
      />
      <Section title="TAHMİNİN DAYANAĞI">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.sizingBasis}</p>
      </Section>
      <Section title="NEDEN ŞİMDİ?">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.whyNow}</p>
      </Section>
      <Section title="BULGULAR">
        <Findings items={data.findings} />
      </Section>
      <ScoreLine score={data.score} rationale={data.scoreRationale} confidence={data.confidence} />
    </>
  );
}

function Competitor({ data }: { data: CompetitorOutput }) {
  return (
    <>
      <Headline text={data.headline} />
      <Section title={`RAKİPLER (${data.competitors.length})`}>
        <ul className="space-y-2">
          {data.competitors.map((competitor, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-3 rounded-xl border border-hairline p-3"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-navy-900">
                  {competitor.url ? (
                    <a
                      href={competitor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-electric-600 hover:underline"
                    >
                      {competitor.name}
                    </a>
                  ) : (
                    competitor.name
                  )}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-navy-500">
                  {competitor.positioning}
                </p>
              </div>
              <SeverityTag severity={competitor.threat} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="KONUMLANDIRMA BOŞLUĞU">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.positioningGap}</p>
      </Section>
      <Section title="BULGULAR">
        <Findings items={data.findings} />
      </Section>
      <ScoreLine score={data.score} rationale={data.scoreRationale} confidence={data.confidence} />
    </>
  );
}

function Feasibility({ data }: { data: FeasibilityOutput }) {
  return (
    <>
      <Headline text={data.headline} />
      <Facts
        rows={[
          ["EFOR", data.effortEstimate],
          ["EN ZOR PARÇA", data.hardestPart],
        ]}
      />
      <Section title="MVP KAPSAMI">
        <Chips items={data.mvpScope} />
      </Section>
      <Section title="KAPSAM DIŞI">
        <Chips items={data.outOfScope} tone="muted" />
      </Section>
      <Section title="TEKNİK RİSKLER">
        <ul className="space-y-2">
          {data.technicalRisks.map((risk, index) => (
            <li key={index} className="rounded-xl border border-hairline p-3">
              <p className="text-[13px] leading-relaxed text-navy-800">{risk.risk}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-navy-500">→ {risk.mitigation}</p>
            </li>
          ))}
        </ul>
      </Section>
      <ScoreLine score={data.score} rationale={data.scoreRationale} confidence={data.confidence} />
    </>
  );
}

function Business({ data }: { data: BusinessOutput }) {
  return (
    <>
      <Headline text={data.headline} />
      <Facts
        rows={[
          ["GELİR MODELİ", data.revenueModel],
          ["FİYAT", data.pricing],
          ["CAC", data.cacAssumption],
          ["LTV", data.ltvAssumption],
        ]}
      />
      <Section title="KÂRLILIĞA GİDEN YOL">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.pathToProfitability}</p>
      </Section>
      <Section title="EN KIRILGAN VARSAYIM">
        <p className="rounded-xl bg-verdict-goif/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-navy-800">
          {data.weakestAssumption}
        </p>
      </Section>
      <Section title="BULGULAR">
        <Findings items={data.findings} />
      </Section>
      <ScoreLine score={data.score} rationale={data.scoreRationale} confidence={data.confidence} />
    </>
  );
}

function Risk({ data }: { data: RiskOutput }) {
  return (
    <>
      <Headline text={data.headline} />
      <Section title="RİSKLER">
        <ul className="space-y-2">
          {data.risks.map((risk, index) => (
            <li key={index} className="rounded-xl border border-hairline p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-semibold tracking-wide text-navy-400">
                  {risk.category}
                </p>
                <SeverityTag severity={risk.severity} />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-navy-800">{risk.description}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-navy-500">→ {risk.mitigation}</p>
            </li>
          ))}
        </ul>
      </Section>
      {data.regulatoryFlags.length > 0 && (
        <Section title="REGÜLASYON">
          <Chips items={data.regulatoryFlags} />
        </Section>
      )}
      <Section title="SAVUNULABİLİRLİK (MOAT)">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.moat}</p>
      </Section>
      <ScoreLine score={data.score} rationale={data.scoreRationale} confidence={data.confidence} />
    </>
  );
}

// ------------------------------------------------------------ TUR 2

function Skeptic({ data }: { data: SkepticOutput }) {
  return (
    <>
      <p className="rounded-xl bg-verdict-nogo/5 p-3.5 text-[13px] leading-relaxed text-navy-800">
        {data.thesis}
      </p>
      <Section title={`SALDIRILAR (${data.attacks.length})`}>
        <ul className="space-y-2">
          {data.attacks.map((attack, index) => (
            <li key={index} className="rounded-xl border border-verdict-nogo/20 bg-verdict-nogo/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-navy-900">{attack.title}</p>
                <SeverityTag severity={attack.severity} />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-navy-600">{attack.argument}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="ÖLDÜRÜCÜ DARBE">
        <p className="text-[13px] leading-relaxed font-medium text-verdict-nogo">{data.killShot}</p>
      </Section>
      <Section title="FİKRİ YENİDEN DÜŞÜNMEMİ SAĞLAYACAK ŞEY">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.wouldReconsiderIf}</p>
      </Section>
    </>
  );
}

const STRATEGY_STYLES: Record<string, string> = {
  EVIDENCE: "bg-verdict-go/10 text-verdict-go",
  PIVOT: "bg-electric-100 text-electric-700",
  CONCEDE: "bg-navy-100 text-navy-600",
};

function Advocate({ data }: { data: AdvocateOutput }) {
  return (
    <>
      <Section title={`CEVAPLAR (${data.rebuttals.length})`}>
        <ul className="space-y-2">
          {data.rebuttals.map((rebuttal, index) => (
            <li key={index} className="rounded-xl border border-verdict-go/20 bg-verdict-go/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-medium text-navy-500">↩ {rebuttal.attackTitle}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                    STRATEGY_STYLES[rebuttal.strategy],
                  )}
                >
                  {strategyLabel(rebuttal.strategy)}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-navy-800">{rebuttal.response}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="ÖNERİLEN PİVOT">
        <p className="rounded-xl bg-electric-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-navy-800">
          {data.proposedPivot}
        </p>
      </Section>
      <Section title="EN SAĞLAM AYAK">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.strongestGround}</p>
      </Section>
      {data.concededPoints.length > 0 && (
        <Section title="SAVUNULAMAYAN NOKTALAR">
          <ul className="space-y-1">
            {data.concededPoints.map((point, index) => (
              <li key={index} className="text-[13px] leading-relaxed text-navy-500">
                • {point}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

// ------------------------------------------------------------ TUR 3

const DECISION_STYLES: Record<string, string> = {
  INVEST: "bg-verdict-go/10 text-verdict-go",
  FOLLOW_UP: "bg-verdict-goif/10 text-verdict-goif",
  PASS: "bg-verdict-nogo/10 text-verdict-nogo",
};

export function DecisionTag({ decision }: { decision: string }) {
  const label = decision === "INVEST" ? "YATIRIM" : decision === "FOLLOW_UP" ? "TAKİPTE" : "PAS GEÇER";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        DECISION_STYLES[decision],
      )}
    >
      {label}
    </span>
  );
}

function Investor({ data }: { data: InvestorOutput }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <DecisionTag decision={data.decision} />
        <span className="text-[12px] text-navy-500">Güven {data.conviction}/100</span>
      </div>
      <p className="text-[13px] leading-relaxed text-navy-800">{data.rationale}</p>
      <Facts rows={[["ÇEK BÜYÜKLÜĞÜ", data.checkSize]]} />
      <Section title="KURUCUYA SORDUĞU 3 SORU">
        <ol className="space-y-1.5">
          {data.questions.map((question, index) => (
            <li key={index} className="flex gap-2 text-[13px] leading-relaxed text-navy-600">
              <span className="font-semibold text-navy-300">{index + 1}</span>
              {question}
            </li>
          ))}
        </ol>
      </Section>
      <Section title="ANLAŞMAYI BOZAN ŞEY">
        <p className="text-[13px] leading-relaxed text-navy-500">{data.dealBreaker}</p>
      </Section>
    </>
  );
}

// ------------------------------------------------------------ TUR 4

function Chair({ data }: { data: ChairOutput }) {
  return (
    <>
      <Headline text={data.oneLiner} />
      <Section title="YATIRIM MEMOSU">
        <div className="space-y-3">
          {data.memo.split("\n\n").map((paragraph, index) => (
            <p key={index} className="text-[13px] leading-relaxed text-navy-600">
              {paragraph}
            </p>
          ))}
        </div>
      </Section>
      {data.conditions.length > 0 && (
        <Section title="KOŞULLAR">
          <ul className="space-y-1.5">
            {data.conditions.map((condition, index) => (
              <li key={index} className="flex gap-2 text-[13px] leading-relaxed text-navy-700">
                <span className="text-verdict-goif">▸</span>
                {condition}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="GÜÇLÜ YANLAR">
          <ul className="space-y-1.5">
            {data.strengths.map((item, index) => (
              <li key={index} className="text-[13px] leading-relaxed text-navy-600">
                + {item}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="ZAYIF YANLAR">
          <ul className="space-y-1.5">
            {data.weaknesses.map((item, index) => (
              <li key={index} className="text-[13px] leading-relaxed text-navy-600">
                − {item}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
