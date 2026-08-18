import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readEvents, type AnalysisEvent } from "@/lib/orchestrator/events";

// Akış canlı olmalı; hiçbir katmanda önbelleğe alınmamalı.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 400;
const HEARTBEAT_MS = 15_000;
const TERMINAL_EVENTS = new Set(["analysis.completed", "analysis.failed"]);

/**
 * Olay akışı. İki modda çalışır:
 *
 * - Canlı: DB'yi kısa aralıklarla yoklar, yeni olayları anında iletir.
 * - Replay (`?replay=1`): tamamlanmış bir analizin olaylarını orijinal
 *   zamanlama aralıklarıyla tekrar oynatır. Demo modunun tamamı bu.
 *
 * Her iki modda da kaynak aynı tablodur; bu yüzden `Last-Event-ID` ile
 * yeniden bağlanma bedavaya gelir: istemci kaldığı seq'ten devam eder.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/analyses/[id]/stream">) {
  const { id } = await ctx.params;
  const replay = request.nextUrl.searchParams.get("replay") === "1";

  const headerSeq = Number(request.headers.get("last-event-id") ?? "");
  const querySeq = Number(request.nextUrl.searchParams.get("from") ?? "");
  const startSeq = Number.isFinite(headerSeq) && headerSeq > 0 ? headerSeq : Number.isFinite(querySeq) ? querySeq : 0;

  const exists = await prisma.analysis.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return new Response("Analiz bulunamadı", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* zaten kapanmış */
        }
      };

      const send = (event: AnalysisEvent) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify({
              seq: event.seq,
              type: event.type,
              payload: event.payload,
            })}\n\n`,
          ),
        );
      };

      const comment = (text: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${text}\n\n`));
      };

      request.signal.addEventListener("abort", close);
      comment("bağlandı");

      try {
        if (replay) {
          await replayEvents(id, startSeq, send, () => closed);
        } else {
          await followLive(id, startSeq, send, comment, () => closed);
        }
      } catch (error) {
        if (!closed) {
          console.error(`[sse] ${id} akış hatası:`, error);
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx / Azure App Service arkasında tamponlamayı kapatır.
      "X-Accel-Buffering": "no",
    },
  });
}

async function followLive(
  analysisId: string,
  startSeq: number,
  send: (event: AnalysisEvent) => void,
  comment: (text: string) => void,
  isClosed: () => boolean,
) {
  let lastSeq = startSeq;
  let lastBeat = Date.now();

  for (;;) {
    if (isClosed()) return;

    const events = await readEvents(analysisId, lastSeq);
    for (const event of events) {
      send(event);
      lastSeq = event.seq;
      if (TERMINAL_EVENTS.has(event.type)) return;
    }

    // Sunucu yeniden başlamışsa veya analiz bu süreçte hiç başlamadıysa
    // sonsuza kadar beklememek için durumu da kontrol et.
    if (!events.length) {
      const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
        select: { status: true },
      });
      if (analysis && (analysis.status === "COMPLETED" || analysis.status === "FAILED")) {
        const tail = await readEvents(analysisId, lastSeq);
        tail.forEach(send);
        return;
      }
    }

    if (Date.now() - lastBeat > HEARTBEAT_MS) {
      comment("keep-alive");
      lastBeat = Date.now();
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/**
 * Kaydedilmiş olayları orijinal aralıklarıyla tekrar oynatır. Aralıklar
 * sıkıştırılır (en fazla 1,2 sn) ki bir dakikalık analiz demoda beklenmesin.
 */
async function replayEvents(
  analysisId: string,
  startSeq: number,
  send: (event: AnalysisEvent) => void,
  isClosed: () => boolean,
) {
  const events = await readEvents(analysisId, startSeq);
  let previous: Date | null = null;

  for (const event of events) {
    if (isClosed()) return;

    const gap = previous ? event.createdAt.getTime() - previous.getTime() : 0;
    previous = event.createdAt;

    const wait = Math.max(140, Math.min(1200, gap));
    await new Promise((resolve) => setTimeout(resolve, wait));

    send(event);
  }
}
