import { z } from "zod";

/**
 * Her ajanın çıktı sözleşmesi. Bunlar iki işi birden görür:
 *  1. Gemini'ye `responseJsonSchema` olarak gider — model yapısal JSON döndürmek zorunda kalır.
 *  2. Dönen JSON burada tekrar doğrulanır — model şemayı ihlal ederse ajan FAILED olur,
 *     bozuk veri DB'ye ve arayüze sızmaz.
 */

export const CONFIDENCE = ["LOW", "MEDIUM", "HIGH"] as const;
export const SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const finding = z.object({
  label: z.string().describe("Bulgunun 3-6 kelimelik başlığı"),
  detail: z.string().describe("Bulgunun 1-2 cümlelik açıklaması, somut ve sayısal"),
});

/** Tur 1 ajanlarının ortak omurgası: her biri tek bir skor boyutunu besler. */
const round1Base = {
  headline: z.string().describe("Tek cümlelik ana bulgu. Genel geçer değil, bu fikre özel."),
  findings: z.array(finding).min(3).max(5),
  score: z.number().int().min(0).max(100).describe("Bu boyutta fikrin puanı"),
  scoreRationale: z.string().describe("Puanın tek cümlelik gerekçesi"),
  confidence: z.enum(CONFIDENCE).describe("Veri yeterliliğine göre kendi güvenin"),
};

// ---------------------------------------------------------------- TUR 1

export const marketSchema = z.object({
  ...round1Base,
  tam: z.string().describe("Toplam ulaşılabilir pazar, para birimi ve yılla"),
  sam: z.string().describe("Hizmet verilebilir pazar"),
  som: z.string().describe("İlk 3 yılda gerçekçi olarak alınabilecek pay"),
  sizingBasis: z.string().describe("Bu üç sayıya nasıl ulaştığın — varsayımları açıkça yaz"),
  growthRate: z.string().describe("Pazarın yıllık büyüme oranı"),
  whyNow: z.string().describe("Neden bu fikir tam olarak şimdi mümkün veya gerekli?"),
});

export const competitorSchema = z.object({
  ...round1Base,
  competitors: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().describe("Şirketin web sitesi; emin değilsen boş bırak"),
        positioning: z.string().describe("Ne yapıyor, kime satıyor"),
        threat: z.enum(SEVERITY).describe("Bu fikir için tehdit seviyesi"),
      }),
    )
    .min(2)
    .max(6),
  positioningGap: z.string().describe("Rakiplerin doldurmadığı boşluk — varsa"),
  alreadyExists: z.boolean().describe("Bu fikir pratikte zaten var mı?"),
});

export const feasibilitySchema = z.object({
  ...round1Base,
  mvpScope: z.array(z.string()).min(3).max(6).describe("MVP'ye giren özellikler"),
  outOfScope: z.array(z.string()).min(1).max(4).describe("MVP'ye kasten alınmayanlar"),
  technicalRisks: z
    .array(z.object({ risk: z.string(), mitigation: z.string() }))
    .min(2)
    .max(4),
  effortEstimate: z.string().describe("Kişi-ay cinsinden MVP eforu"),
  hardestPart: z.string().describe("Teknik olarak en zor tek şey"),
});

export const businessSchema = z.object({
  ...round1Base,
  revenueModel: z.string().describe("Para tam olarak nereden geliyor"),
  pricing: z.string().describe("Somut fiyat önerisi ve birim"),
  cacAssumption: z.string().describe("Müşteri edinme maliyeti varsayımı ve dayanağı"),
  ltvAssumption: z.string().describe("Yaşam boyu değer varsayımı ve dayanağı"),
  pathToProfitability: z.string().describe("Kârlılığa giden yol, kaç müşteri ve ne kadar sürede"),
  weakestAssumption: z.string().describe("Bu modelde çökerse her şeyi çökerten varsayım"),
});

export const riskSchema = z.object({
  ...round1Base,
  risks: z
    .array(
      z.object({
        category: z.string().describe("Hukuk / Regülasyon / Veri / Etik / Bağımlılık"),
        description: z.string(),
        severity: z.enum(SEVERITY),
        mitigation: z.string(),
      }),
    )
    .min(3)
    .max(5),
  regulatoryFlags: z.array(z.string()).max(4).describe("KVKK/GDPR, lisans, sektörel izin"),
  moat: z.string().describe("Savunulabilirlik: kopyalanmasını ne zorlaştırır?"),
});

// ---------------------------------------------------------------- TUR 2

export const skepticSchema = z.object({
  thesis: z.string().describe("Bu fikir neden 18 ayda ölür? Tek paragraf, acımasız."),
  attacks: z
    .array(
      z.object({
        title: z.string().describe("Saldırının 4-8 kelimelik başlığı"),
        targetAgent: z
          .string()
          .describe("Hedeflenen Tur 1 bulgusu: market, competitor, feasibility, business veya risk"),
        argument: z.string().describe("Somut, sayıya veya emsale dayanan saldırı"),
        severity: z.enum(SEVERITY),
      }),
    )
    .min(3)
    .max(5),
  killShot: z.string().describe("Tek bir cümlede öldürücü darbe"),
  wouldReconsiderIf: z.string().describe("Fikri tekrar düşünmeni sağlayacak tek kanıt"),
});

export const advocateSchema = z.object({
  rebuttals: z
    .array(
      z.object({
        attackTitle: z.string().describe("Cevapladığın saldırının başlığı — birebir aynı"),
        response: z.string().describe("Karşı kanıt ya da saldırıyı etkisizleştiren pivot"),
        strategy: z
          .enum(["EVIDENCE", "PIVOT", "CONCEDE"])
          .describe(
            "EVIDENCE: çürüt. PIVOT: kapsamı değiştirerek etkisizleştir. CONCEDE: haklı, kabul et.",
          ),
        strength: z.enum(CONFIDENCE).describe("Bu cevabın gerçek gücü — kendini kandırma"),
      }),
    )
    .min(3)
    .max(5),
  strongestGround: z.string().describe("Fikrin en sağlam ayağı"),
  proposedPivot: z.string().describe("Saldırıların çoğunu birden etkisizleştiren tek hamle"),
  concededPoints: z
    .array(z.string())
    .max(3)
    .describe("Savunamadığın, dürüstçe kabul ettiğin noktalar"),
});

// ---------------------------------------------------------------- TUR 3

export const INVESTOR_DECISIONS = ["INVEST", "FOLLOW_UP", "PASS"] as const;

export const investorSchema = z.object({
  decision: z.enum(INVESTOR_DECISIONS),
  conviction: z.number().int().min(0).max(100).describe("Kararına ne kadar eminsin"),
  checkSize: z.string().describe("Yatırım yapsan ne kadar ve hangi değerlemeden"),
  rationale: z.string().describe("Kararının gerekçesi — kendi tezine sadık kal"),
  questions: z.array(z.string()).min(3).max(3).describe("Kurucuya soracağın tam 3 soru"),
  dealBreaker: z.string().describe("Kararını PASS'e çevirecek tek şey"),
});

// ---------------------------------------------------------------- TUR 4

export const VERDICTS = ["GO", "GO_IF", "NO_GO"] as const;

export const chairSchema = z.object({
  verdict: z.enum(VERDICTS),
  oneLiner: z.string().describe("Kararın tek cümlelik özeti"),
  memo: z.string().describe("Yatırım memosu. 3-4 paragraf, komiteye yazılmış gibi."),
  conditions: z
    .array(z.string())
    .max(4)
    .describe("GO_IF ise hangi koşullar sağlanmalı. Değilse boş dizi."),
  dissent: z
    .string()
    .describe("Muhalefet şerhi: azınlıkta kalan görüşü onun ağzından, en güçlü haliyle yaz."),
  changeMyMind: z
    .array(z.object({ item: z.string(), why: z.string() }))
    .min(3)
    .max(3)
    .describe("Bu kararı değiştirecek tam 3 şey"),
  strengths: z.array(z.string()).min(2).max(4),
  weaknesses: z.array(z.string()).min(2).max(4),
});

export type MarketOutput = z.infer<typeof marketSchema>;
export type CompetitorOutput = z.infer<typeof competitorSchema>;
export type FeasibilityOutput = z.infer<typeof feasibilitySchema>;
export type BusinessOutput = z.infer<typeof businessSchema>;
export type RiskOutput = z.infer<typeof riskSchema>;
export type SkepticOutput = z.infer<typeof skepticSchema>;
export type AdvocateOutput = z.infer<typeof advocateSchema>;
export type InvestorOutput = z.infer<typeof investorSchema>;
export type ChairOutput = z.infer<typeof chairSchema>;

/**
 * Gemini'nin `responseJsonSchema` alanı draft-07 bekliyor ama `$schema` ve
 * `additionalProperties` anahtarlarını reddediyor. Zod çıktısını temizliyoruz.
 */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  return strip(json) as Record<string, unknown>;
}

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$schema" || key === "additionalProperties") continue;
      out[key] = strip(value);
    }
    return out;
  }
  return node;
}
