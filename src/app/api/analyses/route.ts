import { after, type NextRequest } from "next/server";
import { z } from "zod";
import {
  MAX_IDEA_LENGTH,
  MIN_IDEA_LENGTH,
  dailyLimit,
  deriveTitle,
  hashIdea,
  quotaStatus,
} from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { startAnalysis } from "@/lib/orchestrator/run";

const createSchema = z.object({
  ideaText: z
    .string()
    .trim()
    .min(MIN_IDEA_LENGTH, `Fikir en az ${MIN_IDEA_LENGTH} karakter olmalı.`)
    .max(MAX_IDEA_LENGTH, `Fikir en fazla ${MAX_IDEA_LENGTH} karakter olabilir.`),
  /** Yeni versiyon çalıştırılıyorsa önceki analizin id'si. */
  parentId: z.string().optional(),
  evidence: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(120),
        content: z.string().trim().min(20).max(12_000),
        source: z.string().trim().url().optional().or(z.literal("")),
      }),
    )
    .max(8)
    .default([]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 },
    );
  }

  const { ideaText, parentId, evidence } = parsed.data;
  const quota = await quotaStatus();
  if (quota.remaining <= 0) {
    return Response.json(
      { error: `Günlük analiz hakkı doldu (${dailyLimit()}/gün). Yarın tekrar deneyin.` },
      { status: 429 },
    );
  }

  const ideaHash = hashIdea(ideaText);

  // Aynı fikir daha önce analiz edildiyse kotayı yakmadan mevcut sonucu döndür.
  // Versiyon çalıştırmalarında bu atlanır — amaç zaten farkı görmek.
  if (!parentId) {
    const existing = await prisma.analysis.findFirst({
      where: { ideaHash, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) {
      return Response.json({ id: existing.id, cached: true }, { status: 200 });
    }
  }

  const parent = parentId
    ? await prisma.analysis.findUnique({
        where: { id: parentId },
        select: { version: true, evidence: { select: { title: true, content: true, source: true } } },
      })
    : null;

  const analysis = await prisma.analysis.create({
    data: {
      ideaText,
      ideaHash,
      title: deriveTitle(ideaText),
      parentId: parent ? parentId : null,
      version: parent ? parent.version + 1 : 1,
      evidence: {
        create: [...(parent?.evidence ?? []), ...evidence].map((item) => ({
          title: item.title,
          content: item.content,
          source: item.source || null,
        })),
      },
    },
    select: { id: true },
  });

  // Orkestratör yanıtı bloklamaz; istemci ilerlemeyi SSE'den izler.
  after(() => startAnalysis(analysis.id));

  return Response.json({ id: analysis.id, cached: false }, { status: 201 });
}

export async function GET() {
  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      verdict: true,
      overallScore: true,
      disagreement: true,
      simulated: true,
      isDemo: true,
      version: true,
      parentId: true,
      createdAt: true,
    },
  });

  return Response.json({ analyses });
}
