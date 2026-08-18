# PitchArena

> Fikrinize katılan bir yapay zeka değil. Fikrinizi **savunmak zorunda kaldığınız** bir oda.

Tek bir LLM'e "bu fikir iyi mi?" diye sorarsanız neredeyse her zaman iyi olduğunu söyler.
PitchArena bunun yerine **teşvikleri birbirine zıt 11 ajanı** dört tur boyunca karşı karşıya
getirir ve çıktı olarak bir özet değil, muhalefet şerhi içeren bir **yatırım komitesi tutanağı**
üretir.

Ürün tezi ve 10 günlük plan: [`docs/PLAN.md`](docs/PLAN.md).

---

## Hızlı başlangıç

```bash
# 1. Veritabanı (Docker)
docker run -d --name pitcharena-db \
  -e POSTGRES_USER=pitcharena -e POSTGRES_PASSWORD=pitcharena -e POSTGRES_DB=pitcharena \
  -p 127.0.0.1:5433:5432 postgres:18-alpine

# 2. Ortam değişkenleri
cp .env.example .env      # DATABASE_URL'i kendi kurulumunuza göre düzenleyin

# 3. Bağımlılıklar ve şema
npm install
npm run db:migrate

# 4. (İsteğe bağlı ama önerilir) Demo analizlerini üret
npm run db:seed

# 5. Çalıştır
npm run dev               # http://localhost:3000
```

### Gemini anahtarı olmadan da çalışır

`GEMINI_API_KEY` tanımlı değilse sistem **simülasyon sağlayıcısına** düşer. Orkestratör, canlı
akış, skorlama, anlaşmazlık endeksi ve rapor ekranı — hepsi uçtan uca çalışır; yalnızca ajan
metinleri şablon tabanlı olur ve fikre özel muhakeme içermez.

Bu bilinçli bir karar: sunum sırasında kota biterse, internet giderse veya API çökerse ürün
ayakta kalır (`docs/PLAN.md` §7, demo modu). Bu şekilde üretilen her analiz veritabanında
`simulated: true` işaretlenir ve arayüzde açıkça rozetlenir.

Gerçek analiz için `.env` içine anahtarı ekleyip sunucuyu yeniden başlatın:

```
GEMINI_API_KEY="..."
```

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (Turbopack) |
| `npm run build` / `start` | Üretim derlemesi ve sunucusu |
| `npm test` | Birim testleri (şema sözleşmeleri, skorlama, olay indirgeyici) |
| `npm run smoke` | 11 ajanı DB'ye karşı uçtan uca çalıştırır, sunucu gerektirmez |
| `npm run typecheck` / `lint` | TypeScript ve ESLint |
| `npm run db:migrate` | Migration üret ve uygula (geliştirme) |
| `npm run db:deploy` | Mevcut migration'ları uygula (üretim) |
| `npm run db:seed` | Replay edilebilir demo analizleri üretir |
| `npm run db:studio` | Prisma Studio |

---

## Mimari

```
Kullanıcı → POST /api/analyses ──► Analysis (QUEUED)
                                        │
                                        ▼
                              Orchestrator (süreç içi, async)
                                        │
                    ┌───────────┬───────┴───┬──────────────┐
                    ▼           ▼           ▼              ▼
                  TUR 1       TUR 2       TUR 3         TUR 4
               (5 paralel) (2 sıralı)  (3 paralel)   (1 sentez)
                    │           │           │              │
                    └───────────┴─────┬─────┴──────────────┘
                                      ▼
                        her adım → AgentRun + Event tablosuna YAZ
                                            │
GET /api/analyses/:id/stream (SSE) ◄────────┘
```

**Kritik tasarım kararı:** orkestratör bellekte durum tutmaz. Her ajan çıktısı ve her olay anında
veritabanına yazılır. Sonuçları:

- Tarayıcı kapansa analiz devam eder.
- Sayfa yenilenince akış kaldığı yerden devam eder (`Last-Event-ID`).
- Her analiz birebir tekrar oynatılabilir: `/analysis/<id>?replay=1`.

Replay ile canlı akış **aynı bileşeni ve aynı indirgeyiciyi** kullanır; demo modu ayrı bir arayüz
gerektirmez.

### Ajanlar

| Tur | Ajan | Teşviki |
|---|---|---|
| 1 | Pazar Analisti | Sayı bulmak *(grounded)* |
| 1 | Rakip Avcısı | «Bu zaten var» demek *(grounded)* |
| 1 | Teknik Fizibilite | Zorluğu ölçmek |
| 1 | İş Modeli & Birim Ekonomi | «Para nereden geliyor?» |
| 1 | Risk & Regülasyon | Tehlike bulmak |
| 2 | Şüpheci Yatırımcı | **Fikri öldürmek** |
| 2 | Kurucu Avukatı | **Fikri savunmak** |
| 3 | Melek Yatırımcı | Ekip ve zamanlama > metrik |
| 3 | Seri A Yatırımcısı | Traction ve pazar büyüklüğü |
| 3 | Kurumsal Yatırımcı (CVC) | Stratejik uyum |
| 4 | Yatırım Komitesi Başkanı | Anlaşmazlığı tutanağa geçirmek |

Tur 1-3 `gemini-3.6-flash`, Tur 4 `gemini-pro-latest` kullanır — ücretsiz katmanı korumak için
ağır muhakeme tek çağrıya sıkıştırılmıştır.

**Model kimlikleri hızla eskiyor.** Google kapattığı modelleri listelemeye devam ediyor ama yeni
hesaplara 404 dönüyor (`gemini-2.5-flash` bunun örneği). Bu yüzden her rolün bir yedek zinciri
var (`src/lib/agents/meta.ts`): birincil model kapalıysa ya da kotası yoksa orkestratör beklemeden
sıradakine geçer ve kullanılan modeli `AgentRun.model` alanına yazar.

Ücretsiz katmanda Pro kotası çoğu hesapta yoktur; o durumda sentez de Flash'a düşer.

### Skorlama

Beş boyut, her biri 0-100. Ajanlar boyut puanını verir; **ağırlıklı ortalamayı sistem hesaplar**
(`src/lib/scoring.ts`), böylece genel puan bir modelin keyfine değil yazılı bir formüle bağlıdır.

| Boyut | Ağırlık |
|---|---|
| Pazar Fırsatı | %25 |
| Rekabet Avantajı | %20 |
| Teknik Yapılabilirlik | %20 |
| İş Modeli | %20 |
| Risk Profili | %15 |

**Anlaşmazlık Endeksi (0-100):** üç yatırımcının kararları arasındaki normalize standart sapma.
0 = fikir birliği, 100 = en uçta ayrışma. Ürünün tezini görselleştiren metrik budur.

### Dizin haritası

```
prisma/schema.prisma          Veri modeli (Analysis, AgentRun, Score, Citation, Event)
src/lib/agents/meta.ts        Ajan meta verisi — istemciye de gider
src/lib/agents/definitions.ts Sistem promptları — yalnızca sunucuda
src/lib/agents/schemas.ts     Zod sözleşmeleri + Gemini JSON şeması dönüşümü
src/lib/llm/gemini.ts         Gerçek sağlayıcı: grounding, rate limit, backoff
src/lib/llm/simulation.ts     Anahtarsız sağlayıcı (demo modunun temeli)
src/lib/orchestrator/run.ts   Dört turluk durum makinesi
src/lib/orchestrator/events.ts Olay yazımı — SSE'nin tek kaynağı
src/lib/analysis-view.ts      Sunucu ve istemcinin paylaştığı görünüm modeli + indirgeyici
src/app/api/.../stream        SSE uç noktası (canlı + replay)
```

---

## Ücretsiz katman ve gizlilik

- **Kota koruması:** dakika başı çağrı sınırı (`GEMINI_RPM_LIMIT`), 429'da üstel geri çekilme,
  günlük analiz sınırı (`DAILY_ANALYSIS_LIMIT`) ve aynı fikir metni için hash tabanlı önbellek.
- **Gizlilik:** analiz sırasında fikir metni Google'a gönderilir ve ücretsiz katmanda model
  eğitiminde kullanılabilir. Arayüz bunu fikir girişinin altında açıkça uyarır: gizli veya
  patentlenmemiş fikirler bu sisteme girilmemelidir.

---

## Bilinen sınırlar

- Kimlik doğrulama henüz yok; analizler kullanıcıya bağlı değil (`User` tablosu hazır, akış bağlı
  değil). Kota bu yüzden kurulum genelindedir, kullanıcı başına değil.
- PDF memo dışa aktarımı ve public paylaşım linki (`/r/[slug]`) yapılmadı.
- **Google Search grounding ücretsiz katmanda çalışmıyor.** Modelin kendisinden ayrı bir kotası
  var ve ücretsiz anahtarlarda sıfır; `googleSearch` aracıyla yapılan çağrı 429 döner. Sistem bunu
  ölümcül saymaz: Pazar Analisti ve Rakip Avcısı kaynaklandırma olmadan yeniden çalıştırılır,
  arayüzde "kaynaklandırma olmadan çalıştı" notu görünür ve kaynak listesi boş kalır. Gerçek
  linkler için faturalandırma açık bir proje gerekiyor.
- Gerçek modelle bir analiz uçtan uca ~3-4 dakika sürüyor (11 çağrı, ücretsiz katman gecikmesi).
