import type { AgentContext, AgentKey } from "@/lib/agents/definitions";
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
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

/**
 * API anahtarı olmadan çalışan sağlayıcı.
 *
 * Bu bir "sahte veri" katmanı değil, ürünün taşıyıcı kolonlarından biri:
 * docs/PLAN.md §7'deki demo modu buna dayanır. Orkestratör, SSE, skorlama,
 * anlaşmazlık endeksi ve rapor ekranı — hepsi gerçek LLM olmadan uçtan uca
 * çalışır. Sunum sırasında kota biterse ürün ayakta kalır.
 *
 * Üretilen metin şablon tabanlıdır ve fikrin anahtar kelimeleriyle beslenir;
 * fikre özel gerçek muhakeme İÇERMEZ. Bu yüzden bu sağlayıcıyla üretilen her
 * analiz DB'de `simulated: true` işaretlenir ve arayüzde açıkça rozetlenir.
 *
 * Deterministiktir: aynı fikir metni her zaman aynı analizi üretir. Bu, demoyu
 * tekrarlanabilir ve testleri stabil yapar.
 */
export class SimulationProvider implements LlmProvider {
  readonly id = "simulation" as const;

  async complete(request: LlmRequest): Promise<LlmResult> {
    // Gerçek çağrının düşünme süresini taklit et — canlı akış ekranı
    // gerçek koşullardaki gibi kademeli dolsun.
    const profile = profileOf(request.context.ideaText);
    const rng = seeded(`${request.context.ideaText}::${request.agentKey}`);

    // Testlerde bekleme anlamsız; süiti dakikalarca uzatıyor.
    if (process.env.SIMULATION_NO_DELAY !== "1") {
      await delay(500 + Math.floor(rng() * 900));
    }

    const json = build(request.agentKey, request.context, profile, rng);

    return {
      json,
      promptTokens: 400 + Math.floor(rng() * 900),
      outputTokens: 200 + Math.floor(rng() * 500),
      citations: [],
    };
  }
}

// ---------------------------------------------------------------- yardımcılar

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — küçük, hızlı, deterministik PRNG. */
function seeded(key: string): () => number {
  let a = hash(key);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const STOPWORDS = new Set([
  "bir","ve","ile","için","olan","olarak","daha","çok","gibi","ama","fakat","veya","ya",
  "bu","şu","o","da","de","ki","mi","mı","mu","mü","her","tüm","kendi","sonra","önce",
  "the","and","for","with","that","this","from","have","are","was","will","can","app",
  "kullanıcı","kullanıcılar","insanlar","kişi","sistem","platform","uygulama","proje",
]);

/** Fikir metninden anlamlı kelimeleri çıkarır; şablonlara doku katar. */
function keywords(text: string, limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const picked = sorted.slice(0, limit).map(([word]) => word);
  return picked.length ? picked : ["fikir"];
}

interface Profile {
  words: string[];
  domain: string;
  scores: Record<"market" | "competitor" | "feasibility" | "business" | "risk", number>;
  crowded: boolean;
  regulated: boolean;
}

/**
 * Tek fikirden tüm ajanların paylaştığı tutarlı bir profil türetir.
 * Ajanların birbiriyle çelişmeyen ama birbirini tekrar da etmeyen çıktı
 * vermesini bu sağlar.
 */
function profileOf(ideaText: string): Profile {
  const rng = seeded(ideaText);
  const words = keywords(ideaText);
  const base = int(rng, 42, 78);
  const jitter = () => Math.max(12, Math.min(94, base + int(rng, -18, 16)));

  const lower = ideaText.toLowerCase();
  const regulated = /sağlık|hasta|klinik|finans|banka|kredi|sigorta|hukuk|avukat|eğitim|çocuk|ilaç/.test(
    lower,
  );

  return {
    words,
    domain: words[0],
    scores: {
      market: jitter(),
      competitor: jitter(),
      feasibility: jitter(),
      business: jitter(),
      risk: regulated ? Math.max(15, jitter() - 15) : jitter(),
    },
    crowded: rng() > 0.45,
    regulated,
  };
}

const CONFIDENCE_FOR = (score: number) => (score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW");

// ---------------------------------------------------------------- üreticiler

function build(
  agentKey: AgentKey,
  ctx: AgentContext,
  profile: Profile,
  rng: () => number,
): unknown {
  switch (agentKey) {
    case "market":
      return marketOutput(profile, rng);
    case "competitor":
      return competitorOutput(profile, rng);
    case "feasibility":
      return feasibilityOutput(profile, rng);
    case "business":
      return businessOutput(profile, rng);
    case "risk":
      return riskOutput(profile);
    case "skeptic":
      return skepticOutput(profile, rng);
    case "advocate":
      return advocateOutput(ctx, profile);
    case "angel":
    case "seriesA":
    case "corporate":
      return investorOutput(agentKey, profile, rng);
    case "chair":
      return chairOutput(ctx, profile, rng);
  }
}

function marketOutput(profile: Profile, rng: () => number): MarketOutput {
  const score = profile.scores.market;
  const tam = int(rng, 3, 48);
  const growth = int(rng, 6, 34);
  const d = profile.domain;

  return {
    headline: `${d} alanında pazar var ancak büyümenin tamamı üst segmentte yoğunlaşıyor.`,
    findings: [
      {
        label: "Pazar büyüklüğü",
        detail: `${d} çözümleri için toplam harcamanın ${tam} milyar dolar civarında olduğu tahmin ediliyor; bu rakam bitişik kategorileri de içeriyor.`,
      },
      {
        label: "Büyüme hızı",
        detail: `Kategori yıllık %${growth} büyüyor, ancak büyümenin büyük kısmı ilk üç oyuncuya gidiyor.`,
      },
      {
        label: "Segment ayrışması",
        detail: `KOBİ segmentinde ödeme isteği düşük, kurumsal segmentte satış döngüsü ${int(rng, 4, 11)} aya çıkıyor.`,
      },
      {
        label: "Coğrafi sınır",
        detail: `Türkiye pazarı tek başına ${int(rng, 40, 180)} milyon dolar seviyesinde; ölçek için ihracat gerekiyor.`,
      },
    ],
    score,
    scoreRationale: `Pazar gerçek ama ${profile.crowded ? "doygun" : "parçalı"}; asıl soru büyüklük değil, hangi segmentin ödeyeceği.`,
    confidence: CONFIDENCE_FOR(score) as MarketOutput["confidence"],
    tam: `${tam} milyar USD (2025, küresel, bitişik kategoriler dahil)`,
    sam: `${(tam / int(rng, 4, 9)).toFixed(1)} milyar USD — ulaşılabilir dil ve coğrafyayla sınırlı`,
    som: `${int(rng, 2, 14)} milyon USD — 3 yılda gerçekçi pay`,
    sizingBasis: `Yukarıdan aşağı yaklaşım: kategori harcaması × hedef segment payı × ulaşılabilir coğrafya. Varsayım: hedef segmentin %${int(rng, 2, 9)}'una ulaşılabiliyor.`,
    growthRate: `Yıllık %${growth}`,
    whyNow: `${d} tarafında birim maliyetler son iki yılda belirgin düştü ve alıcı tarafında bu işi dış kaynağa verme alışkanlığı yerleşti.`,
  };
}

function competitorOutput(profile: Profile, rng: () => number): CompetitorOutput {
  const score = profile.scores.competitor;
  const d = profile.domain;
  const names = ["Northwind", "Kestrel", "Meridian", "Atlas Labs", "Vega", "Orbit"];
  const count = profile.crowded ? 4 : 2;

  return {
    headline: profile.crowded
      ? `${d} alanında en az ${count} kurulmuş oyuncu var; boşluk kategori değil, konumlandırma boşluğu.`
      : `${d} alanında doğrudan rakip az, ama kullanıcı bu işi bugün elle çözüyor.`,
    findings: [
      {
        label: "Doğrudan rakipler",
        detail: `${count} kurulmuş oyuncu benzer vaadi veriyor; ikisi son 18 ayda yatırım aldı.`,
      },
      {
        label: "Görünmez rakip",
        detail: "Kullanıcıların çoğu bu işi bugün Excel ve WhatsApp ile çözüyor; asıl rakip bu alışkanlık.",
      },
      {
        label: "Değiştirme maliyeti",
        detail: `Mevcut araçtan geçiş ${int(rng, 2, 8)} haftalık veri taşıma anlamına geliyor; bu, satışın önündeki asıl engel.`,
      },
    ],
    score,
    scoreRationale: profile.crowded
      ? "Kalabalık pazar; farklılaşma özellikte değil, dağıtım kanalında aranmalı."
      : "Doğrudan rakip azlığı avantaj ama aynı zamanda talebin doğrulanmadığı anlamına da gelebilir.",
    confidence: CONFIDENCE_FOR(score) as CompetitorOutput["confidence"],
    competitors: Array.from({ length: count }, (_, i) => ({
      name: names[(hash(d) + i) % names.length],
      url: "",
      positioning:
        i === 0
          ? `${d} alanında kurumsal segmente satan, yerleşik oyuncu.`
          : `Daha dar bir dikeyde çalışan, self-servis fiyatlandırmalı alternatif.`,
      threat: (i === 0 ? "HIGH" : i === 1 ? "MEDIUM" : "LOW") as CompetitorOutput["competitors"][number]["threat"],
    })),
    positioningGap: `Küçük ekipler için kurulum gerektirmeyen, ilk değerini ilk gün veren bir ${d} çözümü kimse tarafından ciddiye alınmamış.`,
    alreadyExists: profile.crowded,
  };
}

function feasibilityOutput(profile: Profile, rng: () => number): FeasibilityOutput {
  const score = profile.scores.feasibility;
  const months = int(rng, 2, 9);

  return {
    headline: `Teknik olarak yapılabilir; zorluk algoritmada değil veri ve entegrasyon tarafında.`,
    findings: [
      { label: "Çekirdek teknoloji", detail: "Gereken bileşenlerin tamamı hazır servislerle karşılanabiliyor; sıfırdan araştırma gerekmiyor." },
      { label: "Veri bağımlılığı", detail: "Ürünün değeri, ilk günden erişilmesi gereken kaliteli veriye bağlı; bu, teknik değil ticari bir problem." },
      { label: "Ölçek", detail: `İlk ${int(rng, 1, 5)}.000 kullanıcıya kadar tek sunucu yeterli; erken optimizasyon gereksiz.` },
    ],
    score,
    scoreRationale: `MVP ${months} kişi-ayda çıkar; asıl risk kapsamın kontrolsüz büyümesi.`,
    confidence: CONFIDENCE_FOR(score) as FeasibilityOutput["confidence"],
    mvpScope: [
      "Tek kullanıcı akışı: kayıt, ana işlem, sonuç ekranı",
      "Tek entegrasyon — en çok istenen kaynak",
      "Temel raporlama ve dışa aktarma",
      "Basit yetkilendirme",
    ],
    outOfScope: ["Mobil uygulama", "Çoklu dil", "Ekip/rol yönetimi"],
    technicalRisks: [
      {
        risk: "Dış servis bağımlılığı: fiyat veya kota değişirse birim maliyet bozulur.",
        mitigation: "Servis çağrılarını tek bir soyutlama katmanının arkasına al, sağlayıcı değişimini konfigürasyona indir.",
      },
      {
        risk: "Veri kalitesi düşükse çıktı güvenilmez görünür ve kullanıcı bir daha dönmez.",
        mitigation: "Düşük güvenli çıktıyı gizleme; belirsizliği arayüzde açıkça göster.",
      },
      {
        risk: `Kapsam kayması: ${months} aylık plan kolayca ${months * 2} aya çıkar.`,
        mitigation: "MVP dışı her talebi yazılı bir 'sonraki sürüm' listesine al, tartışmayı oraya taşı.",
      },
    ],
    effortEstimate: `${months} kişi-ay (tek geliştirici, tam zamanlı)`,
    hardestPart: "İlk kaliteli veriye erişmek ve onu sürekli taze tutmak.",
  };
}

function businessOutput(profile: Profile, rng: () => number): BusinessOutput {
  const score = profile.scores.business;
  const price = int(rng, 19, 149);
  const cac = int(rng, 40, 320);
  const months = int(rng, 8, 26);
  const ltv = price * months;

  return {
    headline: `Model ayakta duruyor ama LTV/CAC oranı ${(ltv / cac).toFixed(1)}x ve bu oran churn'e aşırı duyarlı.`,
    findings: [
      { label: "Gelir modeli", detail: `Aylık abonelik, kullanıcı başı ${price} USD. Kullanım bazlı ek gelir ikinci aşamada.` },
      { label: "Edinme maliyeti", detail: `Organik kanal olmadan CAC ${cac} USD; ödenen reklamla bu rakam hızla artar.` },
      { label: "Geri ödeme süresi", detail: `CAC ${Math.ceil(cac / price)} ayda geri dönüyor; ${months} aylık ortalama ömürle model kâra geçiyor.` },
    ],
    score,
    scoreRationale: `Birim ekonomi teoride çalışıyor; pratikte her şey churn oranına bakıyor.`,
    confidence: CONFIDENCE_FOR(score) as BusinessOutput["confidence"],
    revenueModel: "SaaS aboneliği; yıllık ödemede iki ay indirim.",
    pricing: `${price} USD / kullanıcı / ay, yıllık ödemede ${Math.round(price * 10)} USD`,
    cacAssumption: `${cac} USD — içerik ve topluluk ağırlıklı kanal varsayımı. Ücretli reklamla 2-3 katına çıkar.`,
    ltvAssumption: `${ltv} USD — ${months} ay ortalama ömür varsayımı (aylık ~%${Math.round(100 / months)} churn).`,
    pathToProfitability: `Sabit giderleri karşılamak için ${int(rng, 180, 900)} ödeyen müşteri gerekiyor; mevcut hızla bu ${int(rng, 14, 30)} ay.`,
    weakestAssumption: `Aylık churn'ün %${Math.round(100 / months)}'te kalacağı varsayımı. Bu oran iki katına çıkarsa LTV yarıya iner ve model çöker.`,
  };
}

function riskOutput(profile: Profile): RiskOutput {
  const score = profile.scores.risk;

  const risks = [
    {
      category: "Bağımlılık",
      description: "Çekirdek işlev tek bir dış sağlayıcıya bağlı; fiyat veya politika değişimi doğrudan ürünü vurur.",
      severity: "HIGH" as const,
      mitigation: "İkinci sağlayıcıyı ilk günden soyutlama katmanına ekle, geçişi test et.",
    },
    {
      category: "Veri / Gizlilik",
      description: profile.regulated
        ? "Özel nitelikli kişisel veri işleniyor; KVKK m.6 açık rıza ve veri minimizasyonu zorunlu."
        : "Kişisel veri işleniyor; aydınlatma metni, saklama süresi ve silme akışı gerekiyor.",
      severity: profile.regulated ? ("CRITICAL" as const) : ("MEDIUM" as const),
      mitigation: "Veriyi en baştan minimize et, saklama süresini yaz, silme talebini ürün akışına göm.",
    },
    {
      category: "Rekabet",
      description: "Yerleşik bir oyuncu bu özelliği ürününe ekleyerek pazarı bir çeyrekte kapatabilir.",
      severity: "MEDIUM" as const,
      mitigation: "Özellik yerine iş akışının tamamına sahip ol; veri ve entegrasyon birikimiyle geçiş maliyeti yarat.",
    },
    {
      category: "Etik",
      description: "Otomatik çıktı kullanıcı kararını yönlendiriyor; hatalı çıktının sorumluluğu belirsiz.",
      severity: "MEDIUM" as const,
      mitigation: "Çıktıyı öneri olarak konumlandır, kaynak göster, insan onayı adımını akışta bırak.",
    },
  ];

  return {
    headline: profile.regulated
      ? "Düzenlenmiş bir alan: regülasyon burada bir detay değil, ürün kararı."
      : "Yıkıcı bir risk yok ama tedarikçi bağımlılığı ve savunulabilirlik zayıf.",
    findings: [
      { label: "En büyük risk", detail: risks[0].description },
      { label: "Uyum yükü", detail: risks[1].description },
      { label: "Savunulabilirlik", detail: "Bugünkü haliyle 3 ayda kopyalanabilir; moat kullanım verisinde birikmeli." },
    ],
    score,
    scoreRationale: profile.regulated
      ? "Regülatif yük yüksek; uyum maliyeti MVP planına dahil edilmemiş."
      : "Riskler yönetilebilir seviyede ama moat zayıf.",
    confidence: CONFIDENCE_FOR(score) as RiskOutput["confidence"],
    risks: risks.slice(0, profile.regulated ? 4 : 3),
    regulatoryFlags: profile.regulated
      ? ["KVKK m.6 — özel nitelikli veri", "GDPR Art. 9", "Sektörel lisans gerekliliği"]
      : ["KVKK aydınlatma yükümlülüğü", "Çerez ve izleme onayı"],
    moat: "Bugün yok. Zamanla birikecek kullanım verisi ve entegrasyon derinliği tek gerçekçi savunma hattı.",
  };
}

function skepticOutput(profile: Profile, rng: () => number): SkepticOutput {
  const weakest = (Object.entries(profile.scores) as Array<[string, number]>).sort(
    (a, b) => a[1] - b[1],
  )[0][0];
  const d = profile.domain;

  const attacks = [
    {
      title: "Ödeme isteği doğrulanmamış",
      targetAgent: "business",
      argument: `Pazar tahmini harcamayı ölçüyor, ödeme isteğini değil. ${d} alanında kullanıcılar bu sorunu bugün ücretsiz araçlarla çözüyor ve "yeterince iyi" ile yaşıyorlar. Ücretli plana geçiş varsayımı hiçbir veriye dayanmıyor.`,
      severity: "CRITICAL" as const,
    },
    {
      title: "Yerleşik oyuncu bunu bir özellik olarak ekler",
      targetAgent: "competitor",
      argument:
        "Bu bir ürün değil, bir özellik. Mevcut bir oyuncunun yol haritasına eklemesi bir çeyrek sürer ve o gün fiyatlandırmanız anlamsızlaşır. Dağıtımı olan kazanır, özelliği olan değil.",
      severity: "HIGH" as const,
    },
    {
      title: "CAC gerçek kanalda iki katına çıkar",
      targetAgent: "business",
      argument:
        "Organik kanal varsayımı ilk 100 müşteride çalışır, sonra durur. Ücretli kanala geçildiğinde CAC en az iki katına çıkar ve geri ödeme süresi ortalama müşteri ömrünü aşar. O noktada büyüdükçe para kaybedersiniz.",
      severity: "HIGH" as const,
    },
    {
      title: "Soğuk başlangıç problemi çözülmemiş",
      targetAgent: weakest === "feasibility" ? "feasibility" : "market",
      argument:
        "Ürünün değeri veriye bağlı, veri ise kullanıcıya bağlı. İlk kullanıcı boş bir ürünle karşılaşıyor ve geri dönmüyor. Bu döngüyü kıracak bir mekanizma planda yok.",
      severity: "MEDIUM" as const,
    },
  ];

  return {
    thesis: `Bu fikir 18 ayda şu şekilde ölür: ilk 50 kullanıcıyı ağınızdan bulursunuz, bu size yanlış bir doğrulama hissi verir. Altıncı ayda organik kanal tükenir, ücretli kanala geçersiniz ve CAC bir anda üçe katlanır. Aynı dönemde ${profile.crowded ? "yerleşik oyuncu" : "yeni bir rakip"} aynı işlevi ürününe ekler. Elinizde ne farklılaşma ne de nakit kalır; ${d} alanında iyi ama gereksiz bir araç olarak kapanırsınız.`,
    attacks: attacks.slice(0, profile.crowded ? 4 : 3),
    killShot:
      "Kimsenin bugün para ödemediği bir sorunu, kimsenin bilmediği bir markayla çözmeye çalışıyorsunuz.",
    wouldReconsiderIf: `${int(rng, 10, 40)} kullanıcının ürünü görmeden ön ödeme yaptığını gösterin — o zaman ödeme isteği argümanım çöker ve fikri baştan değerlendiririm.`,
  };
}

function advocateOutput(ctx: AgentContext, profile: Profile): AdvocateOutput {
  const attacks = ctx.skeptic?.attacks ?? [];
  const strategies = ["EVIDENCE", "PIVOT", "CONCEDE"] as const;

  // Her saldırıya ayrı bir cevap gövdesi; aynı metnin iki kez görünmesi
  // savunmayı ekranda inandırıcılıktan düşürüyor.
  const EVIDENCE_BODIES = [
    `Bu saldırı pazarın tamamını tek bir kitle sayıyor. Oysa hedef segment ${profile.domain} işini haftada birkaç saat elle yapan ekipler; onlar için bu bir konfor değil, doğrudan zaman tasarrufu. Bu segmentte ücretsiz araç zaten yetersiz kalıyor.`,
    "Rakamlar bu saldırıyı desteklemiyor. Ücretli kanala ilk günden geçmek zorunda değiliz: satış hareketi tek bir dikeyde referansla yürüyor ve bu kanalda edinme maliyeti reklamın çok altında kalıyor.",
    `Saldırı, ürünün değerinin veriyle birlikte geldiğini atlıyor. ${profile.domain} tarafında ilk gün bile elle girilebilen tek bir kayıtla kullanıcı çıktıyı görebiliyor; boş ekran problemi ürünün tasarımında zaten çözülmüş durumda.`,
  ];
  const PIVOT_BODIES = [
    "Saldırı, ürünü yatay bir araç olarak varsaydığında geçerli. Kapsamı tek bir dikeye daraltıp o dikeyin iş akışının tamamına sahip olduğumuzda, yerleşik oyuncunun 'özellik olarak ekleme' hamlesi bizi vurmuyor — çünkü onların ekleyeceği şey iş akışı değil, sadece bir düğme.",
    "Bu itirazı kabul etmek yerine konusuz bırakabiliriz: fiyatı kullanıcı başına değil işlem başına kurarsak, saldırının dayandığı birim ekonomi hesabı geçersiz hale gelir ve büyüme maliyeti gelirle birlikte ölçekleniyor.",
  ];

  const rebuttals = attacks.map((attack, i) => {
    // Son saldırıyı kabul et: her saldırıya cevap veren avukat inandırıcı değildir.
    const strategy = i === attacks.length - 1 ? "CONCEDE" : strategies[i % 2];
    return {
      attackTitle: attack.title,
      response:
        strategy === "EVIDENCE"
          ? EVIDENCE_BODIES[Math.floor(i / 2) % EVIDENCE_BODIES.length]
          : strategy === "PIVOT"
            ? PIVOT_BODIES[Math.floor(i / 2) % PIVOT_BODIES.length]
            : "Bu saldırı haklı. Elimizde ödeme isteğini kanıtlayan veri yok ve bunu varmış gibi sunmak yanlış olur. Bu, yatırımdan önce kapatılması gereken bir boşluk.",
      strategy,
      strength: (strategy === "CONCEDE" ? "LOW" : strategy === "EVIDENCE" ? "MEDIUM" : "HIGH") as AdvocateOutput["rebuttals"][number]["strength"],
    };
  });

  // Şema en az 3 cevap istiyor; şüpheci daha az saldırdıysa tamamla.
  while (rebuttals.length < 3) {
    rebuttals.push({
      attackTitle: `Ek itiraz ${rebuttals.length + 1}`,
      response:
        "Bu itiraz ölçek varsayımına dayanıyor. İlk aşamada ölçek hedefi yok; hedef, dar bir segmentte tekrarlanabilir bir satış hareketi kurmak.",
      strategy: "EVIDENCE",
      strength: "MEDIUM",
    });
  }

  return {
    rebuttals: rebuttals.slice(0, 5),
    strongestGround: `${profile.domain} iş akışını uçtan uca bilen ve bu akışın içinde konumlanan bir ürün, tek bir özelliği kopyalayan rakibe karşı savunulabilir.`,
    proposedPivot: `Yatay araçtan tek bir dikeye daral: yalnızca ${profile.domain} ekiplerine sat, fiyatı kullanıcı başına değil iş akışı başına kur. Bu tek hamle hem CAC hem farklılaşma saldırılarını aynı anda etkisizleştiriyor.`,
    concededPoints: [
      "Ödeme isteği bugün kanıtlanmış değil.",
      "Bugün itibarıyla teknik bir moat yok.",
    ],
  };
}

function investorOutput(agentKey: AgentKey, profile: Profile, rng: () => number): InvestorOutput {
  const avg =
    Object.values(profile.scores).reduce((sum, value) => sum + value, 0) /
    Object.values(profile.scores).length;

  // Üç yatırımcı aynı veriye farklı eşiklerle bakar — ayrışma buradan doğar.
  // Ürünün tezi tam olarak bu: aynı fikir, farklı teşvik, farklı karar.
  const config = {
    angel: {
      threshold: 48,
      checkSize: `${int(rng, 25, 150)}.000 USD, ${int(rng, 1, 3)} milyon USD değerleme tavanıyla`,
      lens: "ekip ve zamanlama",
      questions: [
        "Bu işi neden sen yapıyorsun — bu alanda senin sahip olduğun, başkasında olmayan bilgi ne?",
        "İlk 10 kullanıcıyı bu hafta nasıl bulacaksın?",
        "Altı ay sonra bu iş yürümezse ne öğrenmiş olacaksın?",
      ],
      dealBreaker: "Kurucunun bu alanda hiçbir geçmişi yoksa ve ilk kullanıcıya ulaşma planı yoksa geçerim.",
    },
    seriesA: {
      threshold: 68,
      checkSize: `${int(rng, 2, 8)} milyon USD, Seri A, ${int(rng, 12, 40)} milyon USD öncesi değerleme`,
      lens: "traction ve pazar büyüklüğü",
      questions: [
        "Son üç ayın aylık büyüme oranı ve net gelir tutundurması nedir?",
        "Ödeyen müşterilerde aylık churn kaç, kohort bazında eğri nasıl?",
        "Bu pazarın gerçekten milyar dolar ölçeğinde olduğunu gösteren aşağıdan yukarı hesabın var mı?",
      ],
      dealBreaker: "Ödeyen müşteri yoksa ve büyüme eğrisi yoksa bu benim aşamam değil.",
    },
    corporate: {
      threshold: 58,
      checkSize: `${int(rng, 1, 5)} milyon USD, ticari anlaşmaya bağlı stratejik yatırım`,
      lens: "stratejik uyum",
      questions: [
        "Bizim mevcut dağıtım kanalımıza bağlanabilir mi, entegrasyon eforu ne kadar?",
        "Kurumsal satın alma ve güvenlik denetiminden geçebilecek bir mimari var mı?",
        "Üç yıl sonra bu ürün bizim ürünümüzün içinde mi yaşar, yanında mı?",
      ],
      dealBreaker: "Stratejik uyum yoksa finansal getiri tek başına bizim için yeterli değil.",
    },
  }[agentKey as "angel" | "seriesA" | "corporate"];

  const decision: InvestorOutput["decision"] =
    avg >= config.threshold + 8 ? "INVEST" : avg >= config.threshold - 8 ? "FOLLOW_UP" : "PASS";

  return {
    decision,
    conviction: Math.max(20, Math.min(95, Math.round(avg) + int(rng, -10, 10))),
    checkSize: config.checkSize,
    rationale:
      decision === "INVEST"
        ? `Baktığım yer ${config.lens} ve aradığım şey burada var. Riskler ciddi ama benim aşamamda bu risklerin olması normal; asıl mesele bunların bilinerek alınması.`
        : decision === "FOLLOW_UP"
          ? `${capitalize(config.lens)} tarafında sinyal var ama karar verecek kadar değil. Üç ay sonra doğru metrikle geri gelirsen ciddi konuşuruz.`
          : `${capitalize(config.lens)} açısından burada benim aradığım şey yok. Fikir kötü değil, benim tezime uymuyor — bu iki şey aynı değil.`,
    questions: config.questions,
    dealBreaker: config.dealBreaker,
  };
}

function chairOutput(ctx: AgentContext, profile: Profile, rng: () => number): ChairOutput {
  const decisions = ctx.investors.map((entry) => entry.output.decision);
  const invests = decisions.filter((d) => d === "INVEST").length;
  const passes = decisions.filter((d) => d === "PASS").length;

  const verdict: ChairOutput["verdict"] =
    invests >= 2 ? "GO" : passes >= 2 ? "NO_GO" : "GO_IF";

  const split = new Set(decisions).size > 1;
  const dissenter =
    ctx.investors.find((entry) =>
      verdict === "NO_GO" ? entry.output.decision !== "PASS" : entry.output.decision === "PASS",
    ) ?? ctx.investors[0];

  return {
    verdict,
    oneLiner:
      verdict === "GO"
        ? "Komite yatırım yönünde; ana risk ödeme isteğinin kanıtlanmamış olması."
        : verdict === "GO_IF"
          ? "Komite koşullu ilerleme kararı aldı: ödeme isteği kanıtlanırsa yatırım masaya gelir."
          : "Komite bu aşamada yatırım yapmama kararı aldı; kapı kapalı değil, henüz açık değil.",
    memo: [
      `Fikrin özü ${profile.domain} alanında elle yürütülen bir işi otomatikleştirmek. Beş bağımsız analiz pazarın var olduğunda hemfikir; ayrışma pazarın büyüklüğünde değil, bu pazarın bugün ödemeye hazır olup olmadığında.`,
      `Şüpheci yatırımcının en güçlü argümanı ödeme isteğinin doğrulanmamış olması. Kurucu avukatı bunu çürütmedi, kabul etti — komite bu dürüstlüğü kayda geçirir, çünkü bu, riskin bilindiğini gösterir.`,
      split
        ? `Üç yatırımcı ayrıştı: ${decisions.join(", ")}. Bu ayrışma bir belirsizlik değil, bir bilgi: fikir erken aşama tezine uyuyor, geç aşama tezine uymuyor. Doğru okuma, fikrin kötü olduğu değil, henüz yanlış masada olduğudur.`
        : `Üç yatırımcı da aynı yöne baktı (${decisions.join(", ")}). Fikirbirliği burada güven verici, ancak aynı körlüğü paylaşıyor olma ihtimalini de artırıyor.`,
      `Komitenin görüşü: teknik risk yönetilebilir, regülatif yük ${profile.regulated ? "ciddi ve MVP planına dahil edilmemiş" : "sınırlı"}, asıl mesele ticari doğrulama. Karar bu eksene göre verilmiştir.`,
    ].join("\n\n"),
    conditions:
      verdict === "GO_IF"
        ? [
            `90 gün içinde ${int(rng, 15, 40)} ödeyen müşteri`,
            "Aylık churn oranının %5'in altında kalması",
            "İkinci bir tedarikçiyle çalışan entegrasyon kanıtı",
          ]
        : [],
    dissent:
      verdict === "NO_GO"
        ? `${dissenter?.name ?? "Melek Yatırımcı"} muhalefet şerhi: "Komite kanıt istiyor ama bu aşamada kanıt zaten olmaz. Erken aşamada tek ölçülebilir şey kurucunun bu problemi ne kadar iyi tanıdığıdır ve o sinyal burada var. Kanıt bekleyip beklemek, bu fikri kanıtlayan başka birinin arkasından bakmak demektir."`
        : `${dissenter?.name ?? "Seri A Yatırımcısı"} muhalefet şerhi: "Bu karar iyimser bir okumaya dayanıyor. Elimizde tek bir ödeyen müşteri yok; ödeme isteği hakkında bildiğimiz her şey varsayım. Bir kategoride birim ekonomi churn'e bu kadar duyarlıysa, sorunu erken görmemek geç görmekten daha pahalıya patlar. Ben bu turda geçerdim."`,
    changeMyMind: [
      {
        item: `${int(rng, 15, 40)} kullanıcının ürünü görmeden ön ödeme yapması`,
        why: "Ödeme isteği tartışmasını tek başına kapatır; komitenin ana çekincesi budur.",
      },
      {
        item: "Yerleşik bir oyuncunun aynı işlevi ücretsiz olarak ürününe eklemesi",
        why: "Farklılaşma tezini geçersiz kılar ve kararı hızla NO_GO tarafına çeker.",
      },
      {
        item: "İlk kohortta 3 ay sonunda %90 üzeri tutundurma",
        why: "Soğuk başlangıç ve churn itirazlarının ikisini birden zayıflatır.",
      },
    ],
    strengths: [
      "Problem gerçek ve bugün elle çözülüyor — talep uydurulmuş değil.",
      "MVP kapsamı dar ve çıkarılabilir; teknik risk düşük.",
      "Kurucu tarafı zayıf noktaları saklamak yerine kabul etti.",
    ],
    weaknesses: [
      "Ödeme isteği tek bir veriyle bile desteklenmiyor.",
      "Bugün itibarıyla savunulabilirlik yok; kopyalanma süresi bir çeyrek.",
      profile.regulated
        ? "Regülatif uyum maliyeti plana ve bütçeye yansıtılmamış."
        : "Dağıtım kanalı belirsiz; organik büyüme varsayımı kırılgan.",
    ],
  };
}

/** Türkçe büyük harf kuralı: "i" harfi "İ" olur, "I" değil. */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("tr") + text.slice(1);
}
