import { Database, KeyRound, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AGENT_KEYS, AGENT_META } from "@/lib/agents/meta";
import { dailyLimit, quotaStatus } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { readDb } from "@/lib/db-errors";
import { isGroundingUnavailable, llmUnavailableUntil, providerStatus } from "@/lib/llm";

export const metadata = { title: "Ayarlar · PitchArena" };
export const dynamic = "force-dynamic";

/**
 * Sistem durumu ekranı.
 *
 * Ayarlar burada değiştirilmez — hepsi ortam değişkeni ve dolayısıyla
 * dağıtımın parçası. Bu ekranın işi çalışan kurulumu şeffaf göstermek:
 * hangi sağlayıcı aktif, kota nerede, veriler nereye gidiyor.
 */
export default async function SettingsPage() {
  const [quota, countsResult] = await Promise.all([
    quotaStatus(),
    readDb(
      prisma.$transaction([
        prisma.analysis.count(),
        prisma.agentRun.count(),
        prisma.event.count(),
        prisma.citation.count(),
      ]),
      [0, 0, 0, 0] as const,
    ),
  ]);

  const [analyses, runs, events, citations] = countsResult.value;
  const status = providerStatus();
  const usingGemini = status.id === "gemini";
  const rpm = process.env.GEMINI_RPM_LIMIT ?? "10";
  // Anahtar geçerli olsa da kota bitmiş olabilir; o durumda analizler
  // simülasyonla üretilir ve bunun ekranda görünmesi gerekir.
  const quotaLockUntil = llmUnavailableUntil();
  // Arama kotası modelinkinden ayrı ve ücretsiz katmanda çoğu hesapta sıfır.
  const groundingDown = isGroundingUnavailable();

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Ayarlar</h1>
        <p className="mt-1.5 text-sm text-navy-500">
          Çalışan kurulumun durumu. Değerler ortam değişkenlerinden okunur.
        </p>
      </div>

      <Card>
        <CardBody className="p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-electric-500" aria-hidden />
            <h2 className="text-sm font-semibold">LLM sağlayıcısı</h2>
          </div>

          <dl className="mt-4 space-y-3 text-[13px]">
            <Row label="Aktif sağlayıcı">
              {usingGemini ? (
                <Badge variant="go">Gemini</Badge>
              ) : (
                <Badge variant="goif">Simülasyon</Badge>
              )}
            </Row>
            <Row label="GEMINI_API_KEY">
              <span className="font-mono text-[12px] text-navy-600">
                {KEY_STATE_LABEL[status.reason]}
              </span>
            </Row>
            <Row label="Dakika başı çağrı sınırı">
              <span className="font-mono text-[12px] text-navy-600">{rpm} RPM</span>
            </Row>
            {usingGemini && (
              <Row label="Gemini kotası">
                {quotaLockUntil ? (
                  <Badge variant="goif">tükendi</Badge>
                ) : (
                  <Badge variant="go">kullanılabilir</Badge>
                )}
              </Row>
            )}
            {usingGemini && (
              <Row label="Google Search kotası">
                {groundingDown ? (
                  <Badge variant="goif">kapalı</Badge>
                ) : (
                  <Badge variant="go">kullanılabilir</Badge>
                )}
              </Row>
            )}
            <Row label="Günlük analiz sınırı">
              <span className="font-mono text-[12px] text-navy-600">{dailyLimit()}</span>
            </Row>
            <Row label="Bugün kullanılan">
              <span className="font-semibold text-navy-900">
                {quota.used} / {quota.limit}
              </span>
            </Row>
          </dl>

          {status.reason !== "ok" && (
            <p className="mt-4 rounded-lg bg-verdict-goif/10 px-3 py-2.5 text-[12px] leading-relaxed text-navy-700">
              {KEY_STATE_HINT[status.reason]}
            </p>
          )}

          {groundingDown && (
            <p className="mt-4 rounded-lg bg-verdict-goif/10 px-3 py-2.5 text-[12px] leading-relaxed text-navy-700">
              Google Search kotası bu anahtarda kapalı: model çağrıları çalışıyor ama arama
              aracı 429 dönüyor. Pazar Analisti ve Rakip Avcısı aramasız çalışıyor, çıktıları
              «kaynaksız» rozetiyle işaretleniyor ve sayıları doğrulanmamış tahmindir. Gerçek
              kaynak için Google AI Studio’da faturalandırmayı açmanız gerekir.
            </p>
          )}

          {quotaLockUntil && (
            <p className="mt-4 rounded-lg bg-verdict-goif/10 px-3 py-2.5 text-[12px] leading-relaxed text-navy-700">
              Gemini kotası tükendiği için analizler simülasyon sağlayıcısıyla üretiliyor ve
              açıkça «SİMÜLASYON» rozetiyle işaretleniyor. Kota{" "}
              {quotaLockUntil.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}{" "}
              civarında tekrar denenecek; sunucuyu yeniden başlatmak gerekmez.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-electric-500" aria-hidden />
            <h2 className="text-sm font-semibold">Ajan yapılandırması</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="pb-2 text-[11px] font-semibold tracking-wide text-navy-400">Tur</th>
                  <th className="pb-2 text-[11px] font-semibold tracking-wide text-navy-400">Ajan</th>
                  <th className="pb-2 text-[11px] font-semibold tracking-wide text-navy-400">Teşvik</th>
                  <th className="pb-2 text-[11px] font-semibold tracking-wide text-navy-400">Model</th>
                </tr>
              </thead>
              <tbody>
                {AGENT_KEYS.map((key) => AGENT_META[key]).map((agent) => (
                  <tr key={agent.key} className="border-b border-hairline last:border-0">
                    <td className="py-2 text-[12px] text-navy-400">{agent.round}</td>
                    <td className="py-2 text-[13px] font-medium text-navy-900">
                      {agent.name}
                      {agent.grounded && (
                        <span className="ml-2 text-[11px] text-navy-400">kaynaklı</span>
                      )}
                    </td>
                    <td className="py-2 text-[12px] text-navy-500">{agent.incentive}</td>
                    <td className="py-2 font-mono text-[11px] text-navy-500">{agent.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardBody className="p-5">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-electric-500" aria-hidden />
              <h2 className="text-sm font-semibold">Veri</h2>
            </div>
            <dl className="mt-4 space-y-3 text-[13px]">
              <Row label="Analiz">{analyses}</Row>
              <Row label="Ajan çalıştırması">{runs}</Row>
              <Row label="Olay (SSE kaynağı)">{events}</Row>
              <Row label="Kaynak (citation)">{citations}</Row>
            </dl>
          </CardBody>
        </Card>

        <Card className="border-verdict-goif/30">
          <CardBody className="p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-verdict-goif" aria-hidden />
              <h2 className="text-sm font-semibold">Gizlilik</h2>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-navy-600">
              Analiz sırasında fikir metni Google Gemini API&apos;ye gönderilir. Ücretsiz katmanda
              gönderilen veri model eğitiminde kullanılabilir.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-navy-600">
              Bu yüzden arayüzde fikir girişinin altında açık uyarı gösterilir: gizli veya
              patentlenmemiş fikirler bu sisteme girilmemelidir.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

const KEY_STATE_LABEL: Record<string, string> = {
  ok: "tanımlı",
  "no-key": "tanımsız",
  malformed: "tanımlı ama bozuk",
};

const KEY_STATE_HINT: Record<string, string> = {
  "no-key":
    "Anahtar tanımlı olmadığı için sistem simülasyon sağlayıcısına düşüyor. Orkestratör, canlı akış, skorlama ve rapor uçtan uca çalışır; ajan metinleri şablon tabanlıdır. Gerçek analiz için .env dosyasına GEMINI_API_KEY ekleyip sunucuyu yeniden başlatın.",
  malformed:
    "Anahtarın içinde boşluk var — .env satırına anahtarın yanına fazladan metin yapıştırılmış olabilir. Bu haliyle kullanılmıyor, simülasyona düşülüyor. Satır tek parça olmalı ve tırnak içinde durmalı.",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-navy-500">{label}</dt>
      <dd className="text-navy-900">{children}</dd>
    </div>
  );
}
