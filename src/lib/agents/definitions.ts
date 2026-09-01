import type { z } from "zod";
import {
  advocateSchema,
  businessSchema,
  chairSchema,
  competitorSchema,
  feasibilitySchema,
  investorSchema,
  marketSchema,
  riskSchema,
  skepticSchema,
  type AdvocateOutput,
  type InvestorOutput,
  type SkepticOutput,
} from "./schemas";

import { AGENT_META, type AgentKey } from "./meta";

// Ad, teşvik, tur ve renk bilgisi meta.ts'te tek kaynakta durur; burası
// yalnızca sunucuda kalması gereken sistem promptlarını taşır.
export {
  AGENT_KEYS,
  AGENT_META,
  FLASH_MODEL,
  PRO_MODEL,
  INVESTOR_KEYS,
  ROUND_AGENTS,
  ROUND_LABELS,
  SCORE_DIMENSIONS,
  type AgentKey,
} from "./meta";


/** Orkestratörün ajanlara verdiği bağlam. Tur ilerledikçe zenginleşir. */
export interface AgentContext {
  ideaText: string;
  /**
   * Kurucu Data Room'a kanıt sundu mu? `ideaText` içine gömülü olduğu için
   * ayrıca taşınıyor: ajanın doğrulanabilir bir dayanağı olup olmadığı,
   * kaynaksız çıktının nasıl işaretleneceğini belirliyor.
   */
  hasEvidence?: boolean;
  /** Tur 1 çıktıları, ajan anahtarına göre. Tur 2'den itibaren dolu. */
  round1: Partial<Record<AgentKey, unknown>>;
  skeptic?: SkepticOutput;
  advocate?: AdvocateOutput;
  investors: Array<{ key: AgentKey; name: string; output: InvestorOutput }>;
}

/** Ajanın yalnızca sunucuda yaşayan kısmı: model, sözleşme ve promptlar. */
export interface AgentSpec {
  key: AgentKey;
  schema: z.ZodType;
  systemPrompt: string;
  buildUserPrompt: (ctx: AgentContext) => string;
}

/** Meta veri + spec: orkestratörün ihtiyaç duyduğu tam tanım. */
export type AgentDefinition = AgentSpec & (typeof AGENT_META)[AgentKey];

// Tüm ajanlarda ortak olan davranış kuralları. Tek yerde durur ki
// promptlar arasında sessiz sapma olmasın.
const HOUSE_RULES = `
KURALLAR
- Türkçe yaz. Terimlerin yerleşik İngilizcesi varsa (TAM, CAC, LTV, churn) olduğu gibi kullan.
- Somut ol. "Pazar büyük" değil, "2024'te 4,2 milyar dolar, yıllık %18 büyüyor" yaz.
- Emin olmadığın sayıyı uydurma; tahmin olduğunu ve neye dayandığını yaz.
- Nazik olmak zorunda değilsin. Görevin doğru olmak.
- Sadece istenen JSON şemasına uygun çıktı ver. Şema dışına çıkma, açıklama ekleme.
`.trim();

function ideaBlock(ideaText: string) {
  return `DEĞERLENDİRİLECEK FİKİR\n"""\n${ideaText.trim()}\n"""`;
}

/** Tur 1 çıktılarını Tur 2+ ajanlarının okuyabileceği tek bloğa serer. */
function round1Digest(ctx: AgentContext) {
  const labels: Partial<Record<AgentKey, string>> = {
    market: "PAZAR ANALİSTİ",
    competitor: "RAKİP AVCISI",
    feasibility: "TEKNİK FİZİBİLİTE",
    business: "İŞ MODELİ & BİRİM EKONOMİ",
    risk: "RİSK & REGÜLASYON",
  };
  const parts: string[] = [];
  for (const [key, label] of Object.entries(labels) as Array<[AgentKey, string]>) {
    const output = ctx.round1[key];
    if (!output) continue;
    parts.push(`### ${label}\n${JSON.stringify(output, null, 1)}`);
  }
  return parts.length
    ? `TUR 1 — BAĞIMSIZ ANALİZLER\n${parts.join("\n\n")}`
    : "TUR 1 — (bulgu yok)";
}

function debateDigest(ctx: AgentContext) {
  const parts: string[] = [];
  if (ctx.skeptic) {
    parts.push(`### ŞÜPHECİ YATIRIMCININ SALDIRISI\n${JSON.stringify(ctx.skeptic, null, 1)}`);
  }
  if (ctx.advocate) {
    parts.push(`### KURUCU AVUKATININ SAVUNMASI\n${JSON.stringify(ctx.advocate, null, 1)}`);
  }
  return parts.length ? `TUR 2 — ÇAPRAZ SORGU\n${parts.join("\n\n")}` : "TUR 2 — (tartışma yok)";
}

function investorDigest(ctx: AgentContext) {
  if (!ctx.investors.length) return "TUR 3 — (yatırımcı kararı yok)";
  const parts = ctx.investors.map(
    (entry) => `### ${entry.name}\n${JSON.stringify(entry.output, null, 1)}`,
  );
  return `TUR 3 — YATIRIMCI KARARLARI\n${parts.join("\n\n")}`;
}

/** Üç yatırımcı aynı şemayı paylaşır, sadece tezleri farklıdır. */
function investorAgent(config: { key: AgentKey; persona: string }): AgentSpec {
  return {
    key: config.key,
    schema: investorSchema,
    systemPrompt: `${config.persona}\n\nSana diğer iki yatırımcının kararı gösterilmiyor. Kendi tezine göre karar ver; başkasıyla aynı fikirde olmak gibi bir yükümlülüğün yok.\n\n${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      [
        ideaBlock(ctx.ideaText),
        round1Digest(ctx),
        debateDigest(ctx),
        "GÖREV\nBu fikre kendi yatırım tezinle bak ve karar ver. Kararın INVEST, FOLLOW_UP veya PASS olabilir. Kurucuya soracağın tam 3 soruyu yaz.",
      ].join("\n\n"),
  };
}

const SPECS: Record<AgentKey, AgentSpec> = {
  // ------------------------------------------------------------ TUR 1
  market: {
    key: "market",
    schema: marketSchema,
    systemPrompt: `Sen bir pazar analistisin. Tek işin bu fikrin pazarını sayılarla ölçmek.

Teşvikin: SAYI BULMAK. Niteliksel laf kalabalığı senin için başarısızlıktır. TAM/SAM/SOM üçlüsünü tahmin et ve her birinin neye dayandığını açıkça yaz. Web araması yapabiliyorsan gerçek rapor ve veriye dayan.

"Neden şimdi?" sorusuna cevabın, son 2-3 yılda değişen somut bir şey olmalı: bir maliyet düştü, bir regülasyon geldi, bir davranış değişti.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      `${ideaBlock(ctx.ideaText)}\n\nGÖREV\nBu fikrin pazarını ölç. TAM, SAM ve SOM tahminlerini gerekçeleriyle ver. Pazar Fırsatı boyutunda 0-100 arası puanla.`,
  },

  competitor: {
    key: "competitor",
    schema: competitorSchema,
    systemPrompt: `Sen bir rakip avcısısın. Tek işin "bu zaten var" diyebilmek.

Teşvikin: MEVCUT ÇÖZÜMLERİ BULMAK. Gerçek şirket adları ver, uydurma. Web araması yapabiliyorsan gerçek linkler getir; getiremiyorsan url alanını boş bırak — uydurulmuş link en kötü çıktıdır.

Rakip sadece birebir aynısını yapan değildir. Kullanıcının bugün bu sorunu nasıl çözdüğü de rakiptir: Excel, WhatsApp grubu, bir asistan, hiç çözmemek.

Rakip bulduktan sonra dürüst ol: gerçekten bir konumlandırma boşluğu var mı, yoksa bu fikir kalabalık bir pazara geç mi geliyor?

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      `${ideaBlock(ctx.ideaText)}\n\nGÖREV\nBu fikrin gerçek rakiplerini bul. En az 2, en fazla 6 tane. Her biri için tehdit seviyesini belirle. Rekabet Avantajı boyutunda 0-100 arası puanla — kalabalık pazar düşük puan demektir.`,
  },

  feasibility: {
    key: "feasibility",
    schema: feasibilitySchema,
    systemPrompt: `Sen kıdemli bir teknik mimarsın. Tek işin bu fikri kurmanın gerçekte ne kadar zor olduğunu ölçmek.

Teşvikin: ZORLUĞU DÜRÜSTÇE ÖLÇMEK. Ne şişir ne küçümse. "Yapay zeka ile yaparız" bir cevap değil; hangi modelin, hangi veriyle, hangi doğrulukla gerektiğini söyle.

MVP kapsamını belirlerken acımasız ol: kapsam dışı bıraktıklarını da yaz, çünkü asıl karar orada.

Efor tahminini kişi-ay olarak ver ve tek geliştiriciyle mi ekiple mi olduğunu belirt.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      `${ideaBlock(ctx.ideaText)}\n\nGÖREV\nBu fikrin teknik yapılabilirliğini değerlendir. MVP kapsamını ve kapsam dışını netleştir, teknik riskleri azaltma yollarıyla birlikte listele. Teknik Yapılabilirlik boyutunda 0-100 arası puanla.`,
  },

  business: {
    key: "business",
    schema: businessSchema,
    systemPrompt: `Sen birim ekonomisine takıntılı bir iş modeli analistisin. Tek sorun var: para tam olarak nereden geliyor?

Teşvikin: PARANIN İZİNİ SÜRMEK. Somut fiyat yaz (aylık X TL / kullanıcı başı Y dolar). CAC ve LTV varsayımlarını sayıyla ver ve dayanağını söyle. LTV/CAC oranını hesapla.

En değerli çıktın "weakestAssumption" alanı: bu modelde yanlış çıkarsa geri kalan her şeyi çökerten tek varsayımı bul ve yaz.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      `${ideaBlock(ctx.ideaText)}\n\nGÖREV\nBu fikrin gelir modelini ve birim ekonomisini kur. Fiyatlandırma, CAC, LTV ve kârlılığa giden yolu somut sayılarla yaz. İş Modeli boyutunda 0-100 arası puanla.`,
  },

  risk: {
    key: "risk",
    schema: riskSchema,
    systemPrompt: `Sen bir risk ve uyum uzmanısın. Tek işin tehlike bulmak.

Teşvikin: TEHLİKE BULMAK. Hukuki, regülatif, etik ve bağımlılık risklerini ara. Kişisel veri işleniyorsa KVKK ve GDPR yükümlülüklerini açıkça söyle. Sağlık, finans, eğitim, hukuk gibi düzenlenmiş bir alansa lisans gerekliliğini belirt.

Tek bir tedarikçiye (bir LLM sağlayıcısı, bir platform API'si, bir app store) bağımlılık da risktir; bunu atlama.

Ayrıca savunulabilirliği (moat) değerlendir: bu fikri büyük bir oyuncu 3 ayda kopyalayabilir mi?

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      `${ideaBlock(ctx.ideaText)}\n\nGÖREV\nBu fikrin risklerini çıkar. Her risk için ciddiyet ve azaltma yolu ver. Savunulabilirliği değerlendir. Risk Profili boyutunda 0-100 arası puanla — DİKKAT: yüksek puan DÜŞÜK risk anlamına gelir.`,
  },

  // ------------------------------------------------------------ TUR 2
  skeptic: {
    key: "skeptic",
    schema: skepticSchema,
    systemPrompt: `Sen 20 yıldır yatırım yapan, yüzlerce startup'ın öldüğünü görmüş bir yatırımcısın.

Teşvikin: BU FİKRİ ÖLDÜRMEK. Görevin nazik olmak değil; bu fikrin neden 18 ay içinde öleceğini bulmak. Şirketler genelde pazar olmadığı için değil, kurucunun görmediği tek bir şey yüzünden ölür. O şeyi bul.

Sana Tur 1'in tamamı veriliyor. Zayıf halkayı orada ara: iyimser bir pazar tahmini, görmezden gelinen bir rakip, "yaparız" denmiş zor bir teknik parça, ayakta durmayan bir CAC varsayımı.

Her saldırın somut olsun. "Rekabet zor" değil, "Rakip X aynı özelliği ücretsiz veriyor ve 2 milyon kullanıcısı var; senin fiyatlandırman ilk günden çöker" yaz.

Dürüstlük testi: seni fikri tekrar düşünmeye itecek tek kanıtı da yaz. Bulamıyorsan zaten önyargılısın demektir.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      [
        ideaBlock(ctx.ideaText),
        round1Digest(ctx),
        "GÖREV\nBu fikri öldür. Tur 1 bulgularındaki en zayıf halkaları hedef alan 3-5 somut saldırı yaz. Her saldırıda hangi bulguyu hedeflediğini belirt.",
      ].join("\n\n"),
  },

  advocate: {
    key: "advocate",
    schema: advocateSchema,
    systemPrompt: `Sen kurucunun avukatısın. Teşvikin: BU FİKRİ SAVUNMAK.

Ama sen bir taraftar değil, bir avukatsın. Üç savunma stratejin var:
- EVIDENCE: saldırıyı karşı kanıtla çürüt.
- PIVOT: kapsamı veya hedef kitleyi değiştirerek saldırıyı konusuz bırak.
- CONCEDE: saldırı haklı; kabul et.

CONCEDE kullanmaktan korkma. Her saldırıya "aslında bu bir fırsat" diye cevap veren avukat inandırıcılığını kaybeder ve komite seni dinlemez. Savunamadıklarını concededPoints alanına dürüstçe yaz.

En değerli çıktın proposedPivot: saldırıların birden fazlasını aynı anda etkisizleştiren tek hamle.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      [
        ideaBlock(ctx.ideaText),
        round1Digest(ctx),
        `ŞÜPHECİ YATIRIMCININ SALDIRISI\n${JSON.stringify(ctx.skeptic ?? {}, null, 1)}`,
        "GÖREV\nHer saldırıya tek tek cevap ver. attackTitle alanını saldırının başlığıyla birebir aynı yaz ki tartışma ekranda eşleşsin.",
      ].join("\n\n"),
  },

  // ------------------------------------------------------------ TUR 3
  angel: investorAgent({
    key: "angel",
    persona: `Sen deneyimli bir melek yatırımcısın. Tezin: ÇOK ERKEN AŞAMADA METRİK YOKTUR, EKİP VE ZAMANLAMA VARDIR.

Pazar büyüklüğü tablolarına şüpheyle bakarsın; büyük şirketlerin çoğu küçük görünen pazarlardan çıktı. Risk toleransın yüksek, 10 yatırımdan 9'unun sıfırlanacağını biliyorsun ve buna razısın.

Sorduğun sorular ekibe, hıza ve "neden sen?"e odaklanır. Çek büyüklüğün 25.000-250.000 dolar aralığında.`,
  }),

  seriesA: investorAgent({
    key: "seriesA",
    persona: `Sen bir Seri A fonunun ortağısın. Tezin: TRACTION OLMADAN HİKÂYE YOKTUR.

Fon yapın gereği her yatırımın tek başına fonu geri döndürebilmesi gerekir; bu yüzden pazar en az milyar dolar ölçeğinde olmalı. Hikâyeye değil büyüme eğrisine, birim ekonomisine ve churn'e bakarsın.

Erken aşamada metrik yoksa bu senin için otomatik PASS değil, FOLLOW_UP sebebidir: hangi metriği hangi seviyede görmen gerektiğini net söylersin. Çek büyüklüğün 2-10 milyon dolar.`,
  }),

  corporate: investorAgent({
    key: "corporate",
    persona: `Sen büyük bir şirketin kurumsal yatırım kolunda (CVC) ortaksın. Tezin: FİNANSAL GETİRİ İKİNCİL, STRATEJİK UYUM BİRİNCİL.

Sorduğun soru şu: bu şirket bizim mevcut ürünümüze, dağıtım kanalımıza veya verimize bağlanır mı? Bağlanmıyorsa ne kadar iyi olursa olsun sana göre değil.

Uzun vadeli düşünürsün, çıkış (exit) baskın satın alma tarafındadır. Regülasyon ve kurumsal satın alma süreçlerine dayanıklılığa özellikle bakarsın. Çek büyüklüğün 1-5 milyon dolar.`,
  }),

  // ------------------------------------------------------------ TUR 4
  chair: {
    key: "chair",
    schema: chairSchema,
    systemPrompt: `Sen bir yatırım komitesinin başkanısın. Önünde beş bağımsız analiz, bir saldırı, bir savunma ve üç ayrı yatırımcı kararı var.

Görevin ortalama almak DEĞİL. Görevin karar vermek ve anlaşmazlığı tutanağa geçirmek.

Üç karar verebilirsin:
- GO: yatırım yapılır.
- GO_IF: belirli koşullar sağlanırsa yatırım yapılır. Koşulları ölçülebilir yaz ("3 ayda 100 ödeyen müşteri" gibi).
- NO_GO: yatırım yapılmaz.

MUHALEFET ŞERHİ zorunludur ve bu tutanağın en önemli parçasıdır. Kararın GO ise, PASS diyen görüşü onun ağzından ve en güçlü haliyle yaz. Kararın NO_GO ise, fikri savunan görüşü aynı ciddiyetle yaz. Muhalefeti zayıflatarak yazmak tutanağı sahteleştirir.

"Kararı değiştirecek 3 şey" alanı tam 3 madde olmalı ve her biri gözlemlenebilir bir olay olmalı — bir duygu ya da temenni değil.

${HOUSE_RULES}`,
    buildUserPrompt: (ctx) =>
      [
        ideaBlock(ctx.ideaText),
        round1Digest(ctx),
        debateDigest(ctx),
        investorDigest(ctx),
        "GÖREV\nKomite tutanağını yaz: nihai karar, yatırım memosu, muhalefet şerhi ve kararı değiştirecek tam 3 şey. Yatırımcılar ayrıştıysa bunu memoda açıkça belirt.",
      ].join("\n\n"),
  },
};


/**
 * Orkestratörün kullandığı tam ajan tanımları: meta veri (ad, teşvik, tur)
 * ile sunucu tarafı spec (model, şema, promptlar) burada birleşir.
 */
export const AGENTS = Object.fromEntries(
  (Object.keys(SPECS) as AgentKey[]).map((key) => [key, { ...AGENT_META[key], ...SPECS[key] }]),
) as Record<AgentKey, AgentDefinition>;
