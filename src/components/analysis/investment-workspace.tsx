"use client";

import { useState } from "react";
import {
  Check,
  Database,
  Loader2,
  MessageCircleQuestion,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

type Evidence = {
  id: string;
  title: string;
  content: string;
  source: string | null;
};

type Challenge = {
  id: string;
  question: string;
  context: string | null;
  answer: string | null;
};

type Citation = {
  url: string;
  title: string;
};

export function InvestmentWorkspace({
  analysisId,
  evidence,
  challenges,
  citationCount,
}: {
  analysisId: string;
  evidence: Evidence[];
  challenges: Challenge[];
  citationCount: number;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <DataRoom evidence={evidence} citationCount={citationCount} />
      <CommitteeAsk analysisId={analysisId} />
      <FounderStressTest analysisId={analysisId} initial={challenges} />
    </section>
  );
}

function DataRoom({
  evidence,
  citationCount,
}: {
  evidence: Evidence[];
  citationCount: number;
}) {
  return (
    <Card className="xl:row-span-2">
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Database className="size-4 text-electric-500" />
              Data Room
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-500">
              Komitenin dayandığı kurucu kanıtları ve doğrulanabilir kaynaklar.
            </p>
          </div>
          <span className="rounded-lg bg-electric-50 px-2 py-1 text-[11px] font-bold text-electric-700">
            {evidence.length + citationCount} kayıt
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {evidence.length > 0 ? (
            evidence.map((item) => (
              <EvidenceRow
                key={item.id}
                title={item.title}
                text={item.content}
                href={item.source}
              />
            ))
          ) : (
            <Empty text="Henüz kurucu kanıtı eklenmedi. Bir sonraki sürümde Data Room notu ekleyin." />
          )}
        </div>

        <div className="mt-5 border-t border-hairline pt-4">
          <p className="text-[11px] font-semibold tracking-wide text-navy-400">
            GÜVEN SİNYALİ
          </p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-3xl font-bold text-navy-900">
              {citationCount > 0 ? "Kanıtlı" : "Varsayıma açık"}
            </span>
            <ShieldCheck
              className={`mb-1 size-5 ${citationCount > 0 ? "text-verdict-go" : "text-verdict-goif"}`}
            />
          </div>
          <p className="mt-1 text-[12px] text-navy-500">
            {citationCount
              ? `${citationCount} harici kaynak, komite bulgularına bağlandı.`
              : "Kaynak bulunmayan iddiaları kurucu kanıtıyla güçlendirin."}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function EvidenceRow({
  title,
  text,
  href,
}: {
  title: string;
  text: string;
  href: string | null;
}) {
  const body = (
    <>
      <p className="text-[12px] font-semibold text-navy-800">{title}</p>
      <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-navy-500">{text}</p>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl border border-hairline bg-surface p-3 transition-colors hover:border-electric-200"
      >
        {body}
      </a>
    );
  }

  return <div className="rounded-xl border border-hairline bg-surface p-3">{body}</div>;
}

function CommitteeAsk({ analysisId }: { analysisId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (question.trim().length < 4) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setAnswer(data.answer ?? data.error);
      setCitations(data.citations ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <MessageCircleQuestion className="size-4 text-electric-500" />
          Komiteye sor
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-navy-500">
          Rapor, ajan çıktıları ve Data Room içinden kaynaklı yanıt al.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && ask()}
            placeholder="Örn. En büyük risk ne?"
            className="min-w-0 flex-1 rounded-xl border border-hairline bg-surface px-3 text-[13px] text-navy-900 placeholder:text-navy-300"
          />
          <Button type="button" size="sm" onClick={ask} disabled={busy || question.trim().length < 4}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Sor"}
          </Button>
        </div>

        {answer && (
          <div className="mt-4 rounded-xl bg-navy-50 p-3">
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-navy-700">
              {answer}
            </p>
            {citations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {citations.map((item) => (
                  <a
                    key={item.url}
                    className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-electric-700 ring-1 ring-electric-100"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function FounderStressTest({
  analysisId,
  initial,
}: {
  analysisId: string;
  initial: Challenge[];
}) {
  const [items, setItems] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function save(challengeId: string) {
    const answer = drafts[challengeId]?.trim();
    if (!answer || answer.length < 10) return;

    setSaving(challengeId);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, answer }),
      });
      const data = await response.json();

      if (data.challenge) {
        setItems((current) =>
          current.map((item) =>
            item.id === challengeId ? { ...item, answer: data.challenge.answer } : item,
          ),
        );
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="xl:col-span-2">
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Target className="size-4 text-verdict-goif" />
              Kurucu stres testi
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-navy-500">
              Komitenin kararını değiştirecek maddeleri kanıtla. Cevapların bir sonraki sürümün
              Data Room’una dönüşür.
            </p>
          </div>
          <span className="rounded-lg bg-verdict-goif/10 px-2 py-1 text-[11px] font-bold text-verdict-goif">
            {items.filter((item) => item.answer).length}/{items.length} yanıt
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-hairline bg-surface p-4">
              <p className="text-[11px] font-bold text-electric-600">TEST {index + 1}</p>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-navy-800">
                {item.question}
              </p>
              {item.context && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-navy-500">{item.context}</p>
              )}
              {item.answer ? (
                <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-verdict-go">
                  <Check className="mt-0.5 size-3.5 shrink-0" />
                  {item.answer}
                </p>
              ) : (
                <>
                  <textarea
                    value={drafts[item.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    rows={3}
                    placeholder="Kanıtınla cevapla..."
                    className="mt-3 w-full rounded-lg border border-hairline bg-white p-2 text-[12px] text-navy-800 placeholder:text-navy-300"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => save(item.id)}
                    disabled={saving === item.id || (drafts[item.id]?.trim().length ?? 0) < 10}
                  >
                    {saving === item.id ? <Loader2 className="size-3 animate-spin" /> : "Yanıtı kaydet"}
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline p-4 text-[12px] leading-relaxed text-navy-400">
      {text}
    </div>
  );
}
