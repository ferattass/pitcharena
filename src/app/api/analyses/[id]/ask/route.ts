import { z } from "zod";
import { prisma } from "@/lib/db";

const requestSchema = z.object({ question: z.string().trim().min(4).max(500) });

function terms(value: string) {
  return new Set(value.toLocaleLowerCase("tr-TR").match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

export async function POST(request: Request, ctx: RouteContext<"/api/analyses/[id]/ask">) {
  const { id } = await ctx.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçerli bir soru yazın." }, { status: 400 });

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { runs: { where: { status: "COMPLETED" }, include: { citations: true } }, evidence: true },
  });
  if (!analysis) return Response.json({ error: "Analiz bulunamadı." }, { status: 404 });

  const questionTerms = terms(parsed.data.question);
  const candidates = [
    ...analysis.runs.map((run) => ({
      title: run.agentKey,
      text: JSON.stringify(run.rawJson ?? {}),
      citations: run.citations.map((citation) => ({ url: citation.url, title: citation.title })),
    })),
    ...analysis.evidence.map((item) => ({
      title: item.title,
      text: item.content,
      citations: item.source ? [{ url: item.source, title: item.title }] : [],
    })),
  ]
    .map((item) => ({ ...item, score: [...terms(item.text)].filter((term) => questionTerms.has(term)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const supporting = candidates.filter((item) => item.score > 0);
  const selected = supporting.length ? supporting : candidates;
  const answer = selected.length
    ? selected
        .map((item) => `${item.title}: ${item.text.replace(/[{}\[\]"]/g, " ").replace(/\s+/g, " ").slice(0, 360)}`)
        .join("\n\n")
    : "Komitenin bu soruyu yanıtlayacak yeterli kaydı yok. Data Room’a kanıt ekleyip analizi revize edin.";

  return Response.json({
    answer,
    citations: [...new Map(selected.flatMap((item) => item.citations).map((citation) => [citation.url, citation])).values()].slice(0, 5),
  });
}
