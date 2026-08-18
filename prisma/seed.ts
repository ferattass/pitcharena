/**
 * Demo modu tohumlaması.
 *
 * docs/PLAN.md §7'de demo modu "pazarlıksız" olarak işaretli: sunum sırasında
 * kota bitse, internet gitse veya API çökse bile ekranda akan bir analiz
 * olmalı. Bu betik önceden çalıştırılmış analizleri DB'ye yazar; arayüz
 * bunları `?replay=1` ile aynı streaming animasyonuyla tekrar oynatır.
 *
 *   npx tsx prisma/seed.ts
 */
process.loadEnvFile(".env");

const DEMO_IDEAS = [
  `Küçük hukuk bürolarının dava dosyalarındaki duruşma tarihlerini ve yasal süreleri
otomatik takip eden, tebligatları okuyup avukatın takvimine düşen ve süre kaçırma riskini
önceden uyaran bir asistan. Hedef kitle 1-5 avukatlı bürolar; büro başına aylık abonelik.`,

  `Restoranların günlük satış verisinden yarınki malzeme ihtiyacını tahmin edip tedarikçiye
otomatik sipariş geçen bir sistem. Hedef kitle 2-10 şubeli zincirler; gıda israfını ve stok
maliyetini düşürmeyi hedefliyor. Şube başına aylık ücret alınacak.`,

  `Üniversite öğrencilerinin ders notlarını paylaştığı, notların kalitesini akran
değerlendirmesiyle sıralayan ve en çok okunan not yazarlarına reklam gelirinden pay veren
bir platform. Önce tek bir üniversitede başlayıp kampüs kampüs büyüyecek.`,
];

async function main() {
  // .env yüklendikten sonra çözülmeli — db.ts import anında DATABASE_URL okuyor.
  const { deriveTitle, hashIdea } = await import("../src/lib/analysis");
  const { prisma } = await import("../src/lib/db");
  const { runAnalysis } = await import("../src/lib/orchestrator/run");

  for (const ideaText of DEMO_IDEAS) {
    const ideaHash = hashIdea(ideaText);

    const existing = await prisma.analysis.findFirst({
      where: { ideaHash, isDemo: true, status: "COMPLETED" },
      select: { id: true, title: true },
    });

    if (existing) {
      console.log(`atlandı (zaten var): ${existing.title}`);
      continue;
    }

    const analysis = await prisma.analysis.create({
      data: {
        ideaText: ideaText.replace(/\s+/g, " ").trim(),
        ideaHash,
        title: deriveTitle(ideaText.replace(/\s+/g, " ").trim()),
        isDemo: true,
      },
    });

    console.log(`çalıştırılıyor: ${analysis.title}`);
    await runAnalysis(analysis.id);

    const result = await prisma.analysis.findUniqueOrThrow({
      where: { id: analysis.id },
      select: { status: true, verdict: true, overallScore: true, disagreement: true },
    });
    console.log(
      `  → ${result.status} · ${result.verdict} · puan ${result.overallScore} · anlaşmazlık ${result.disagreement}`,
    );
  }

  const demos = await prisma.analysis.count({ where: { isDemo: true, status: "COMPLETED" } });
  console.log(`\nhazır: ${demos} demo analizi replay edilebilir durumda.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Bu dosyayı modül yap: aksi halde TS global kapsamda görür ve
// iki betiğin `main` tanımı çakışır.
export {};
