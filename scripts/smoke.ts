/**
 * Orkestratörün uçtan uca dumanı: analiz kaydı aç, 11 ajanı çalıştır,
 * olayları ve skorları doğrula. Sunucuya ihtiyaç duymaz.
 *
 *   npx tsx scripts/smoke.ts
 */
process.loadEnvFile(".env");

const IDEA = `Küçük hukuk bürolarının dava dosyalarındaki duruşma tarihlerini ve süreleri
otomatik takip eden, UYAP bildirimlerini okuyup avukatın takvimine düşen ve süre kaçırma
riskini önceden uyaran bir asistan. Hedef kitle 1-5 avukatlı bürolar.`;

async function main() {
  // Modüller .env yüklendikten SONRA çözülmeli: db.ts import anında
  // DATABASE_URL okuyor. Bu yüzden statik import değil dinamik import.
  const { deriveTitle, hashIdea } = await import("../src/lib/analysis");
  const { prisma } = await import("../src/lib/db");
  const { readEvents } = await import("../src/lib/orchestrator/events");
  const { runAnalysis } = await import("../src/lib/orchestrator/run");

  const analysis = await prisma.analysis.create({
    data: {
      ideaText: IDEA,
      ideaHash: hashIdea(IDEA),
      title: deriveTitle(IDEA),
    },
  });

  console.log(`analiz: ${analysis.id}`);
  console.log(`başlık: ${analysis.title}`);

  const began = Date.now();
  await runAnalysis(analysis.id);
  const took = ((Date.now() - began) / 1000).toFixed(1);

  const [final, runs, scores, events] = await Promise.all([
    prisma.analysis.findUniqueOrThrow({ where: { id: analysis.id } }),
    prisma.agentRun.findMany({ where: { analysisId: analysis.id }, orderBy: { round: "asc" } }),
    prisma.score.findMany({ where: { analysisId: analysis.id } }),
    readEvents(analysis.id),
  ]);

  console.log(`\nsüre: ${took}s`);
  console.log(`durum: ${final.status}  karar: ${final.verdict}  puan: ${final.overallScore}`);
  console.log(`anlaşmazlık: ${final.disagreement}  simülasyon: ${final.simulated}`);
  console.log(`\najanlar (${runs.length}):`);
  for (const run of runs) {
    console.log(
      `  T${run.round} ${run.agentKey.padEnd(12)} ${run.status.padEnd(10)} ${String(run.latencyMs ?? "-").padStart(6)}ms  ${run.errorMessage ?? ""}`,
    );
  }
  console.log(`\nskorlar:`);
  for (const score of scores) console.log(`  ${score.dimension.padEnd(22)} ${score.value}`);
  console.log(`\nolay sayısı: ${events.length}`);
  console.log(`olay tipleri: ${[...new Set(events.map((e) => e.type))].join(", ")}`);

  const failed = runs.filter((r) => r.status !== "COMPLETED");
  if (final.status !== "COMPLETED" || failed.length) {
    console.error(`\nBAŞARISIZ: ${final.errorMessage ?? `${failed.length} ajan tamamlanamadı`}`);
    process.exitCode = 1;
  } else {
    console.log("\nTAMAM — 11/11 ajan, uçtan uca çalışıyor.");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Bu dosyayı modül yap: aksi halde TS global kapsamda görür ve
// iki betiğin `main` tanımı çakışır.
export {};
