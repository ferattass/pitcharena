import { z } from "zod";
import { prisma } from "@/lib/db";

const answerSchema = z.object({
  challengeId: z.string().min(1),
  answer: z.string().trim().min(10).max(8_000),
});

export async function POST(request: Request, ctx: RouteContext<"/api/analyses/[id]/challenges">) {
  const { id } = await ctx.params;
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ error: "Yanıt en az 10 karakter olmalı." }, { status: 400 });
  }

  const challenge = await prisma.founderChallenge.findFirst({
    where: { id: parsed.data.challengeId, analysisId: id },
    select: { id: true },
  });
  if (!challenge) return Response.json({ error: "Soru bulunamadı." }, { status: 404 });

  const updated = await prisma.founderChallenge.update({
    where: { id: challenge.id },
    data: { answer: parsed.data.answer, answeredAt: new Date() },
    select: { id: true, answer: true, answeredAt: true },
  });
  return Response.json({ challenge: updated });
}
