"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { MAX_IDEA_LENGTH, MIN_IDEA_LENGTH } from "@/lib/constants";

const EXAMPLES = [
  "Küçük hukuk bürolarının duruşma tarihlerini ve yasal süreleri otomatik takip eden, süre kaçırma riskini önceden uyaran bir asistan. Hedef kitle 1-5 avukatlı bürolar.",
  "Restoranların günlük satış verisinden yarınki malzeme ihtiyacını tahmin edip tedarikçiye otomatik sipariş geçen bir sistem. İsraf ve stok maliyetini düşürmeyi hedefliyor.",
  "Üniversite öğrencilerinin ders notlarını paylaştığı, notların kalitesini akran değerlendirmesiyle sıralayan ve en iyi not yazarlarına gelir paylaşımı veren bir platform.",
];

export function IdeaForm({ parentId, initialText }: { parentId?: string; initialText?: string }) {
  const router = useRouter();
  const [ideaText, setIdeaText] = useState(initialText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const length = ideaText.trim().length;
  const tooShort = length < MIN_IDEA_LENGTH;
  const busy = submitting || pending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaText, parentId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Analiz başlatılamadı.");
        return;
      }
      startTransition(() => router.push(`/analysis/${data.id}`));
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardBody className="p-6">
          <label htmlFor="idea" className="text-sm font-semibold text-navy-900">
            {parentId ? "Fikri revize et" : "Fikrini yaz"}
          </label>
          <p className="mt-1 text-[13px] text-navy-500">
            Ne kadar somut yazarsan analiz o kadar keskin olur. Kime sattığını, hangi sorunu
            çözdüğünü ve nasıl para kazanacağını yaz.
          </p>

          <textarea
            id="idea"
            value={ideaText}
            onChange={(event) => setIdeaText(event.target.value.slice(0, MAX_IDEA_LENGTH))}
            rows={7}
            placeholder="Örneğin: Küçük muhasebe ofislerinin müşterilerinden gelen fişleri WhatsApp üzerinden toplayıp otomatik olarak muhasebe programına işleyen bir servis…"
            className="mt-4 w-full resize-y rounded-xl border border-hairline bg-surface p-4 text-sm leading-relaxed text-navy-900 placeholder:text-navy-300 focus:border-electric-300 focus:bg-card"
            aria-describedby="idea-help"
          />

          <div id="idea-help" className="mt-2 flex items-center justify-between text-[12px]">
            <span className={tooShort && length > 0 ? "text-verdict-nogo" : "text-navy-400"}>
              {length < MIN_IDEA_LENGTH
                ? `En az ${MIN_IDEA_LENGTH} karakter (${length}/${MIN_IDEA_LENGTH})`
                : `${length} / ${MAX_IDEA_LENGTH} karakter`}
            </span>
            <span className="text-navy-400">11 ajan · 4 tur</span>
          </div>

          {!parentId && (
            <div className="mt-5">
              <p className="text-[12px] font-medium text-navy-500">Hazır örnekler</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setIdeaText(example)}
                    className="rounded-lg border border-hairline bg-card px-3 py-1.5 text-left text-[12px] text-navy-600 transition-colors hover:border-electric-300 hover:text-navy-900"
                  >
                    {example.split(" ").slice(0, 5).join(" ")}…
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-verdict-nogo/10 px-3 py-2 text-[13px] text-verdict-nogo">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="flex max-w-md items-start gap-2 text-[12px] leading-relaxed text-navy-500">
              <ShieldAlert className="mt-px size-4 shrink-0 text-navy-400" aria-hidden />
              <span>
                Fikriniz analiz için Google Gemini&apos;ye gönderilir. Ücretsiz katmanda gönderilen
                veri model eğitiminde kullanılabilir — <strong>gizli veya patentlenmemiş fikir
                girmeyiniz.</strong>
              </span>
            </p>

            <Button type="submit" size="lg" disabled={tooShort || busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Başlatılıyor…
                </>
              ) : (
                <>
                  {parentId ? "Yeni versiyonu çalıştır" : "Analizi başlat"}
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
