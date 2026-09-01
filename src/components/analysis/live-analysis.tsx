"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Radio } from "lucide-react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ROUND_LABELS, TOTAL_AGENTS } from "@/lib/agents/meta";
import {
  applyEvent,
  completedCount,
  emptyAgents,
  type AnalysisView,
  type StreamEvent,
} from "@/lib/analysis-view";
import { cn } from "@/lib/utils";
import { Report, SimulationNotice } from "./report";
import { RoundSection } from "./round-section";

const EVENT_TYPES = [
  "analysis.started",
  "round.started",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "agent.degraded",
  "round.completed",
  "scores.computed",
  "analysis.completed",
  "analysis.failed",
] as const;

/**
 * Canlı analiz ekranı.
 *
 * Olayları SSE üzerinden alır ve saf bir reducer'a (applyEvent) verir.
 * Replay modunda tek fark akışın kaynağıdır — ekran kodu aynıdır, bu yüzden
 * demo modu ayrı bir arayüz gerektirmez.
 */
export function LiveAnalysis({
  initial,
  replay = false,
}: {
  initial: AnalysisView;
  replay?: boolean;
}) {
  const router = useRouter();
  // Replay'de ekran sıfırdan dolmalı: kaydedilmiş sonuç değil, sonucun
  // oluşma süreci gösteriliyor. Bu yüzden durum da başa alınır.
  const [view, setView] = useState<AnalysisView>(() =>
    replay
      ? {
          ...initial,
          status: "RUNNING",
          verdict: null,
          overallScore: null,
          disagreement: null,
          agents: emptyAgents(),
          scores: [],
          activeRound: null,
          lastSeq: 0,
        }
      : initial,
  );
  const [connected, setConnected] = useState(false);
  const seqRef = useRef(view.lastSeq);
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const finished = view.status === "COMPLETED" || view.status === "FAILED";
    finishedRef.current = finished;
    if (!replay && finished) return;

    const clearRetry = () => {
      if (retryRef.current !== null) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const detachSource = () => {
      if (!sourceRef.current) return;
      for (const type of EVENT_TYPES) sourceRef.current.removeEventListener(type, handler);
      sourceRef.current.close();
      sourceRef.current = null;
    };

    const scheduleReconnect = (delay = 1200) => {
      if (replay || finishedRef.current || retryRef.current !== null) return;
      retryRef.current = window.setTimeout(() => {
        retryRef.current = null;
        connect();
      }, delay);
    };

    const handler = (event: MessageEvent<string>) => {
      let parsed: StreamEvent;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      seqRef.current = Math.max(seqRef.current, parsed.seq);
      setView((current) => applyEvent(current, parsed));

      if (parsed.type === "analysis.completed" || parsed.type === "analysis.failed") {
        finishedRef.current = true;
        detachSource();
        clearRetry();
        setConnected(false);
        if (!replay) router.refresh();
      }
    };

    const connect = () => {
      if (finishedRef.current && !replay) return;
      clearRetry();
      detachSource();

      const query = replay ? "?replay=1" : `?from=${seqRef.current}`;
      const source = new EventSource(`/api/analyses/${initial.id}/stream${query}`);
      sourceRef.current = source;

      source.onopen = () => setConnected(true);
      source.onerror = () => {
        setConnected(false);
        scheduleReconnect();
      };

      for (const type of EVENT_TYPES) source.addEventListener(type, handler);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !finishedRef.current) {
        connect();
      }
    };

    const onFocus = () => {
      if (!finishedRef.current) connect();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      clearRetry();
      detachSource();
    };
    // Akış bir kez kurulur; sonraki güncellemeler reducer üzerinden gelir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, replay]);

  if (view.status === "FAILED") {
    return <FailureCard view={view} />;
  }

  if (view.status === "COMPLETED") {
    return <Report view={view} />;
  }

  return (
    <div className="space-y-5">
      {view.simulated && <SimulationNotice />}
      <ProgressStrip view={view} connected={connected} replay={replay} />
      <RoundSection view={view} round={1} />
      <RoundSection view={view} round={2} />
      <RoundSection view={view} round={3} />
      <RoundSection view={view} round={4} />
    </div>
  );
}

function ProgressStrip({
  view,
  connected,
  replay,
}: {
  view: AnalysisView;
  connected: boolean;
  replay: boolean;
}) {
  const done = completedCount(view);
  const percent = Math.round((done / TOTAL_AGENTS) * 100);

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="live">
              <Radio className="size-3" aria-hidden />
              {replay ? "REPLAY" : "CANLI"}
            </Badge>
            {connected ? (
              <LiveDot label={replay ? "Kayıt oynatılıyor" : "Ajanlar çalışıyor"} />
            ) : (
              <span className="text-[11px] text-navy-400">bağlanıyor…</span>
            )}
          </div>
          <p className="text-[12px] text-navy-500">
            {done} / {TOTAL_AGENTS} ajan tamamlandı
          </p>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-electric-500 transition-[width] duration-500"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {([1, 2, 3, 4] as const).map((round) => {
            const active = view.activeRound === round;
            const passed = view.activeRound !== null && round < view.activeRound;
            return (
              <li
                key={round}
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                  active && "bg-electric-500 text-white",
                  passed && "bg-navy-50 text-navy-500",
                  !active && !passed && "bg-surface text-navy-300",
                )}
              >
                Tur {round} · {ROUND_LABELS[round]}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

function FailureCard({ view }: { view: AnalysisView }) {
  return (
    <Card className="border-verdict-nogo/30">
      <CardBody className="flex items-start gap-3 p-6">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-verdict-nogo" aria-hidden />
        <div>
          <h3 className="text-base font-semibold">Analiz tamamlanamadı</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-600">
            {view.errorMessage ?? "Bilinmeyen bir hata oluştu."}
          </p>
          <p className="mt-3 text-[12px] text-navy-400">
            Tamamlanan ajanların çıktıları aşağıda korunuyor — analiz sıfırdan başlamaz.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
