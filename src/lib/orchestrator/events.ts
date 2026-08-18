import { prisma } from "@/lib/db";

/**
 * Olay akışının tek kaynağı DB'dir. Orkestratör bellekte hiçbir şey tutmaz;
 * SSE de bellekten değil buradan okur. Sonuç: sayfa yenilenebilir, tarayıcı
 * kapanabilir, analiz devam eder ve her analiz sonradan replay edilebilir.
 */
export type EventType =
  | "analysis.started"
  | "round.started"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "agent.degraded"
  | "round.completed"
  | "scores.computed"
  | "analysis.completed"
  | "analysis.failed";

export interface AnalysisEvent {
  seq: number;
  type: EventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// Aynı analiz için eş zamanlı yazımları sıraya sokar. Tur 1'de beş ajan
// paralel çalışıyor; seq'in çakışmaması için yazımlar serileştirilir.
const writeQueues = new Map<string, Promise<unknown>>();

export function emit(
  analysisId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const previous = writeQueues.get(analysisId) ?? Promise.resolve();
  const next = previous.then(() => write(analysisId, type, payload));

  // Kuyruk hata yüzünden kırılmasın; bir olay yazılamazsa sonrakiler devam etsin.
  writeQueues.set(
    analysisId,
    next.catch(() => undefined),
  );
  return next;
}

async function write(
  analysisId: string,
  type: EventType,
  payload: Record<string, unknown>,
): Promise<void> {
  // Serileştirmeye rağmen (çok süreçli dağıtımda) çakışma olabilir; unique
  // ihlalinde bir sonraki numarayla tekrar dener.
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.event.findFirst({
      where: { analysisId },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });

    try {
      await prisma.event.create({
        data: {
          analysisId,
          seq: (last?.seq ?? 0) + 1,
          type,
          payload: payload as never,
        },
      });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }
  throw new Error(`Olay yazılamadı: ${type}`);
}

export async function readEvents(analysisId: string, afterSeq = 0): Promise<AnalysisEvent[]> {
  const rows = await prisma.event.findMany({
    where: { analysisId, seq: { gt: afterSeq } },
    orderBy: { seq: "asc" },
  });

  return rows.map((row) => ({
    seq: row.seq,
    type: row.type as EventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }));
}

/** Analiz bittiğinde kuyruk kaydını bırak; uzun süren süreçte bellek şişmesin. */
export function releaseQueue(analysisId: string) {
  writeQueues.delete(analysisId);
}
