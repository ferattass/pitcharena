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
import { isDatabaseUnavailableError } from "@/lib/db-errors";
import { createOfflineAnalysis, listOfflineAnalyses } from "@/lib/offline-analyses";
import { startAnalysis } from "@/lib/orchestrator/run";

const createSchema = z.object({
  ideaText: z
    .string()
    .trim()
    .min(MIN_IDEA_LENGTH, `Fikir en az ${MIN_IDEA_LENGTH} karakter olmalı.`)
    .max(MAX_IDEA_LENGTH, `Fikir en fazla ${MAX_IDEA_LENGTH} karakter olabilir.`),
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

  try {
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

    after(() => startAnalysis(analysis.id));

    return Response.json({ id: analysis.id, cached: false }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      // DB yok: analizi bellekte üret. Sağlayıcı kotası bitmişse `executeAgent`
      // simülasyona düşer, yani buraya ancak ajanlar şema sözleşmesini bozarsa
      // hata gelir — o durumda da istemciye 500 değil okunur bir mesaj dönmeli.
      try {
        const offline = await createOfflineAnalysis({
          ideaText,
          parentId,
          evidence: evidence.map((item) => ({
            title: item.title,
            content: item.content,
            source: item.source || null,
          })),
        });
        return Response.json({ id: offline.analysis.id, cached: false, offline: true }, { status: 201 });
      } catch (offlineError) {
        console.error("[analyses] çevrimdışı analiz üretilemedi:", offlineError);
        return Response.json(
          {
            error:
              "Veritabanına erişilemiyor ve çevrimdışı analiz üretilemedi. " +
              "Birkaç dakika sonra tekrar deneyin.",
          },
          { status: 503 },
        );
      }
    }
    throw error;
  }
}

export async function GET() {
  try {
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
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const analyses = listOfflineAnalyses().map((record) => ({
        id: record.analysis.id,
        title: record.analysis.title,
        status: record.analysis.status,
        verdict: record.analysis.verdict,
        overallScore: record.analysis.overallScore,
        disagreement: record.analysis.disagreement,
        simulated: record.analysis.simulated,
        isDemo: false,
        version: record.analysis.version,
        parentId: record.analysis.parentId,
        createdAt: record.analysis.createdAt,
      }));
      return Response.json({ analyses });
    }
    throw error;
  }
}
