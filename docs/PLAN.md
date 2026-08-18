# PitchArena — Çoklu Ajan Girişim Fikri Analiz Platformu

> Staj projesi · Microsoft Summer Program · 10 gün · Tek geliştirici

---

## 1. Ürün Tezi

Tek bir LLM'e "bu fikir iyi mi?" diye sorarsan sana **her zaman** iyi olduğunu söyler.
Modeller onaylamaya eğilimlidir (sycophancy). Bu yüzden "ChatGPT'ye sordum" bir ürün değil.

PitchArena'nın tezi şudur: **değer, tek bir cevapta değil, birbiriyle çatışan cevaplarda.**

Birbirine karşı **teşvikleri farklı** ajanlar kurulur:
- Birinin işi fikri **öldürmek**tir.
- Birinin işi fikri **savunmak**tır.
- Üçünün işi **farklı yatırım tezleriyle** karar vermektir.
- Birinin işi **anlaşmazlığı tutanağa geçirmek**tir.

Çıktı bir "özet" değil, bir **yatırım komitesi tutanağı**dır: karar, muhalefet şerhi,
ve "bu kararı değiştirecek 3 şey" listesi.

**Jüriye söylenecek tek cümle:**
> "Bu, fikrinize katılan bir yapay zeka değil. Fikrinizi *savunmak zorunda kaldığınız* bir oda."

### Rakiplerden ayrışma
| Yaklaşım | Sorun | PitchArena |
|---|---|---|
| ChatGPT'ye sormak | Onaylayıcı, kaynaksız, tekrarlanamaz | Çelişkili ajanlar, kaynaklı, kayıtlı |
| Tek promptta "5 uzman gibi davran" | Aynı modelin tek çıktısı — sahte çeşitlilik | Ayrı çağrılar, ayrı bağlam, gerçek çapraz sorgu |
| Statik iş planı şablonları | Fikre özel değil | Fikre özel + web'den gerçek rakip verisi |

---

## 2. Teknoloji Kararları (ve Gerekçeleri)

| Katman | Karar | Gerekçe |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Tek dil, tek repo. 10 günde en yüksek hız. Server Actions + SSE ile canlı ajan akışı doğal. |
| DB | **PostgreSQL + Prisma** | İlişkisel model (analiz → tur → ajan çıktısı) tam oturuyor. Prisma tip güvenliği TS ile uçtan uca. |
| LLM | **Google Gemini API** (ücretsiz katman) | Maliyet sıfır. Native `responseSchema` (yapısal JSON) + Google Search grounding ücretsiz katmanda mevcut. |
| Orkestrasyon | **Elle yazılmış TS state machine** | LangChain/LangGraph 10 günde risk ve kara kutu. Kendi motorunu yazmak hem daha az bağımlılık hem mülakatta **anlatacak bir şey**. |
| Stil | **Tailwind CSS 4 + shadcn/ui** | Hızlı + şık. Jüri gözü önce arayüze bakar. |
| Grafik | **Recharts** | Radar chart (5 boyutlu skor) ve skor deltası. |
| Auth | **Auth.js (NextAuth) — GitHub + Google** | 30 dakikada biter, kendi şifre yönetimini yazma. |
| Deploy | **Azure App Service + Azure Database for PostgreSQL** | Microsoft programı. Azure'da çalışan ürün + GitHub Actions CI/CD göstermek doğrudan puan. |
| Test | **Vitest + Playwright (kritik akış)** | "Test yazmış" demek yetmez, orkestratörün determinist testi olmalı. |

### Reddedilen alternatifler
- **.NET / ASP.NET Core** — Microsoft teması cazip ama 10 günde LLM streaming + React arayüz ekosistemi Next.js'te 3x hızlı. Azure'a deploy ederek Microsoft bağını zaten kuruyoruz.
- **Redis + BullMQ** — Ek altyapı, ek deploy yükü. Yerine: orkestratör in-process çalışır, **her adım DB'ye yazılır**, SSE DB'den okur. Bağlantı kopsa bile analiz kaldığı yerden okunur.
- **LangChain** — Soyutlama katmanı hata ayıklamayı zorlaştırır, sürüm kırılmaları risk.

---

## 3. Ajan Mimarisi

11 ajan, 4 tur. Her ajanın **tek bir işi** ve **tek bir teşviki** var.

### TUR 1 — Bağımsız Analiz (paralel, birbirini görmez)
Körlük kasıtlı: ajanlar birbirini görmezse gerçekten bağımsız görüş üretirler.

| # | Ajan | Teşviki | Üretir |
|---|---|---|---|
| 1 | **Pazar Analisti** | Sayı bulmak | TAM/SAM/SOM tahmini, büyüme, "neden şimdi?" · *grounded* |
| 2 | **Rakip Avcısı** | "Bu zaten var" demek | Gerçek rakipler + linkler, konumlandırma boşluğu · *grounded* |
| 3 | **Teknik Fizibilite** | Zorluğu ölçmek | Yapılabilirlik, teknik risk, MVP kapsamı, efor tahmini |
| 4 | **İş Modeli & Birim Ekonomi** | Para nereden geliyor? | Gelir modeli, CAC/LTV varsayımları, kârlılık yolu |
| 5 | **Risk & Regülasyon** | Tehlike bulmak | Hukuk, KVKK/GDPR, lisans, etik, savunulabilirlik (moat) |

### TUR 2 — Çapraz Sorgu (adversaryal)
Buradan itibaren ajanlar **Tur 1'in tamamını görür**.

| # | Ajan | Teşviki |
|---|---|---|
| 6 | **Şüpheci Yatırımcı** | **Fikri öldürmek.** En zayıf halkayı bulup saldırır. "Bu fikir neden 18 ayda ölür?" |
| 7 | **Kurucu Avukatı** | **Fikri savunmak.** Her saldırıya ya karşı kanıt ya da saldırıyı etkisizleştiren bir pivot önerir. |

> Bu tur ürünün kalbi. Ekranda canlı akan bir *tartışma* olarak gösterilir.

### TUR 3 — Yatırımcı Simülasyonu (paralel, 3 farklı tez)
Aynı fikre, farklı tezlerle bakan üç yatırımcı. **Farklı kararlar vermeleri normaldir ve gösterilir.**

| # | Persona | Tez | Üretir |
|---|---|---|---|
| 8 | **Melek Yatırımcı** | Ekip ve zamanlama > metrik. Yüksek risk toleransı. | Karar, çek büyüklüğü, sorduğu 3 soru |
| 9 | **Seri A VC** | Traction ve pazar büyüklüğü takıntılı. | Karar + hangi metrikleri görmek istediği |
| 10 | **Kurumsal / CVC** | Stratejik uyum, entegrasyon, uzun vade. | Karar + stratejik gerekçe |

### TUR 4 — Sentez
| # | Ajan | Üretir |
|---|---|---|
| 11 | **Yatırım Komitesi Başkanı** | Nihai karar (**GO / GO-IF / NO-GO**), yatırım memo'su, **muhalefet şerhi**, "kararı değiştirecek 3 şey" |

### Model dağılımı (ücretsiz katmanı korumak için)
- Tur 1, 2, 3 → `gemini-3.6-flash` (hızlı, kotası geniş)
- Tur 4 (sentez) → `gemini-pro-latest` (tek çağrı, ağır muhakeme)

> **Uygulama notu (18.08.2026):** plan yazılırken seçilen `gemini-2.5-flash` / `gemini-2.5-pro`
> yeni hesaplara kapatıldı — Google modeli listelemeye devam ediyor ama çağrıda 404 dönüyor.
> Her rol için yedek model zinciri eklendi (`src/lib/agents/meta.ts`); birincil model kapalıysa
> ya da kotası yoksa orkestratör sıradakine geçer. Ücretsiz katmanda Pro kotası olmadığı için
> sentez pratikte Flash'a düşüyor.

---

## 4. Sistem Mimarisi

```
Kullanıcı
   │  fikir metni
   ▼
POST /api/analyses ──► Analysis kaydı (status: QUEUED)
   │                        │
   │                        ▼
   │                  Orchestrator (in-process, async)
   │                        │
   │            ┌───────────┼───────────┬──────────────┐
   │            ▼           ▼           ▼              ▼
   │          TUR 1       TUR 2       TUR 3         TUR 4
   │        (5 paralel) (2 sıralı) (3 paralel)   (1 sentez)
   │            │           │           │              │
   │            └───────────┴─────┬─────┴──────────────┘
   │                              ▼
   │                    her adım → AgentRun + Event tablosuna YAZ
   ▼                                        │
GET /api/analyses/:id/stream (SSE) ◄────────┘
   │  event: agent.started / agent.token / agent.completed / round.completed
   ▼
Canlı Tartışma Arayüzü
```

**Kritik tasarım kararı:** orkestratör hiçbir şeyi bellekte tutmaz. Her ajan çıktısı
anında DB'ye yazılır. Sonuç:
- Tarayıcı kapansa analiz devam eder
- Sayfayı yenileyince kaldığı yerden akmaya devam eder
- Her analiz **tam olarak tekrar oynatılabilir** (replay) — demo için hayati

### Veri Modeli (Prisma)
```
User            id, email, name, image
Analysis        id, userId, ideaText, title, status, verdict, overallScore,
                parentId (versiyon zinciri), createdAt
AgentRun        id, analysisId, agentKey, round, status, model,
                promptTokens, outputTokens, latencyMs, rawJson, startedAt, endedAt
Score           id, analysisId, dimension, value(0-100), rationale
Citation        id, agentRunId, url, title, snippet
Event           id, analysisId, seq, type, payload, createdAt   ← SSE kaynağı
```

`parentId` sayesinde: "fikri revize et → tekrar çalıştır → **v1 vs v2 skor farkı**".
Bu, ürünün bir oyuncak değil bir **araç** olduğunu kanıtlayan özellik.

---

## 5. Skorlama

Beş boyut, her biri 0–100. Ajanlar skoru **kendileri değil**, yapısal çıktı olarak verir;
sistem ağırlıklı ortalamayı hesaplar (deterministik, tekrarlanabilir).

| Boyut | Ağırlık | Kaynak ajan |
|---|---|---|
| Pazar Fırsatı | 25% | Pazar Analisti |
| Rekabet Avantajı | 20% | Rakip Avcısı |
| Teknik Yapılabilirlik | 20% | Teknik Fizibilite |
| İş Modeli | 20% | İş Modeli |
| Risk Profili | 15% | Risk & Regülasyon |

**Anlaşmazlık Endeksi (Consensus Meter):** 3 yatırımcının kararları arasındaki varyans.
Hepsi aynı fikirdeyse yüksek güven; ayrışıyorlarsa "tartışmalı fikir" rozeti.
*Bu metrik ürünün tezini görselleştirir — jüriye anlatacağın şey tam olarak budur.*

---

## 6. "Vay be" Anları (Demo Silahları)

1. **Canlı tartışma akışı** — Ajanlar sırayla ekranda "düşünür" ve birbirine cevap verir. SSE ile token token.
2. **Şüpheci VC saldırısı** — Ekranda kırmızı bir kart açılır: "Bu fikir neden 18 ayda ölür?" Sonra Kurucu Avukatı yeşil kartla cevap verir.
3. **Radar chart** — 5 boyut, tek bakışta.
4. **Anlaşmazlık göstergesi** — "3 yatırımcıdan 2'si GO dedi, 1'i NO-GO. İşte neden."
5. **Versiyon karşılaştırma** — Fikri düzelt, tekrar çalıştır, skorun 61 → 78'e çıktığını gör.
6. **Kaynaklı rakip listesi** — Google Search grounding ile gerçek linkler. "Halüsinasyon mu?" sorusunu baştan öldürür.
7. **PDF yatırım memo'su** — İndirilebilir, gerçek bir çıktı.
8. **Paylaşılabilir link** — `/r/[slug]` public rapor.

---

## 7. Ücretsiz Katman Gerçekliği ⚠️

Bu bölüm projenin en büyük teknik riski. Ciddiye al.

**Analiz başına ~11–14 LLM çağrısı.** Gemini ücretsiz katman limitleri
(RPM/RPD) sık değişir — **ilk gün resmi limitleri doğrula ve buraya yaz.**

### Zorunlu önlemler
1. **Rate limiter + kuyruk** — dakika başı çağrı sınırı, 429'da exponential backoff.
2. **Cache** — aynı fikir metninin hash'i → mevcut analizi döndür.
3. **Kota göstergesi** — arayüzde "bugün kalan analiz hakkı".
4. **🔴 DEMO MODU (pazarlıksız)** — Önceden kaydedilmiş 2–3 analiz, **aynı streaming animasyonuyla** replay edilir. Sunum sırasında API çökse, kota bitse, internet gitse bile demo kusursuz akar. Event tablosu zaten replay'e uygun — bu neredeyse bedava geliyor.
5. **Gizlilik notu** — Ücretsiz katmanda gönderilen veri model eğitimi için kullanılabilir. Arayüzde açıkça belirt: *"Fikirleriniz Google'a gönderilir, gizli/patentlenmemiş fikir girmeyiniz."* Jüri bunu sorar; cevabının hazır olması olgunluk göstergesidir.

---

## 8. 10 Günlük Plan

| Gün | Hedef | Bitiş Kriteri |
|---|---|---|
| **1** | Kurulum + Gemini bağlantısı | Next.js ayakta, Prisma şeması migrate, **tek ajan** uçtan uca yapısal JSON döndürüyor |
| **2** | Orkestratör motoru + Tur 1 | 5 ajan paralel çalışıp DB'ye yazıyor (arayüz yok, test var) |
| **3** | SSE + canlı arayüz iskeleti | Tarayıcıda ajan çıktıları canlı akıyor |
| **4** | Tur 2, 3, 4 | 11 ajanın tamamı zincirleme çalışıyor, nihai karar üretiliyor |
| **5** | Skorlama + rapor sayfası | Radar chart, verdict rozeti, anlaşmazlık göstergesi |
| **6** | Google Search grounding | Rakip/pazar verisi kaynaklı, linkler tıklanabilir |
| **7** | Auth + geçmiş + versiyonlama | Giriş yap, analizlerini gör, v1/v2 karşılaştır |
| **8** | Tasarım cilası + TR/EN | Ürün "yapılmış" değil "tasarlanmış" görünüyor |
| **9** | 🔴 Demo modu + rate limit + hata yönetimi + testler | API'yi kapat, demo hâlâ çalışıyor |
| **10** | Azure deploy + README + demo videosu + sunum | Canlı URL, GitHub Actions yeşil |

### Risk: bu plan agresif
10 gün, 11 ajan, tam ürün. **Gün 5 sonunda** dürüst bir değerlendirme yap.
Geride kalınırsa kesilecekler, bu sırayla: PDF export → TR/EN → versiyon karşılaştırma → grounding.
**Asla kesilmeyecekler:** canlı streaming, adversaryal tur, demo modu.

---

## 9. Jüri Sunumu İçin Notlar

Anlatacağın hikâye şu sırayla:
1. **Problem** — "Fikrini ChatGPT'ye soranlar hep 'harika fikir' cevabı alıyor."
2. **İçgörü** — "Değer onayda değil, çelişkide."
3. **Çözüm** — Canlı demo: Şüpheci VC'nin saldırısı → Kurucu Avukatı'nın savunması.
4. **Mühendislik** — Orkestratör state machine, event-sourced replay, yapısal çıktı doğrulama.
5. **Olgunluk** — Kota yönetimi, gizlilik uyarısı, demo fallback, CI/CD. *Bunlar seni "ödev yapan öğrenci"den ayıran şeyler.*

---

## 10. Sonraki Adım
`docs/AGENTS.md` — her ajanın sistem promptu ve JSON şeması (Gün 1–2).
