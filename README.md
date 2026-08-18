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
| `npm run build` | Üretim derlemesi + standalone paketin toplanması (`postbuild`) |
| `npm start` | Standalone sunucuyu çalıştırır (`.next/standalone/server.js`) |
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

---

## Azure'a deploy

### Neden B1, neden F1 değil

Orkestratör `POST /api/analyses` cevabı döndükten **sonra** süreç içinde arka planda
çalışmaya devam eder. App Service'in ücretsiz (F1) planında uygulama boşta kalınca askıya
alınır ve devam eden analiz ortasında ölür. Bu yüzden **B1 + Always On** gerekir; mimarinin
doğrudan dayattığı bir maliyet kalemidir.

SSE tarafında ek bir ayar gerekmez: App Service'in ~230 saniyelik boşta kalma zaman aşımını
akışın 15 saniyelik heartbeat'i zaten sıfırlar.

### Kaynakları oluştur

```bash
az login

RG=pitcharena-rg; LOC=westeurope
APP=pitcharena          # genel olarak benzersiz olmalı
DB=pitcharena-db        # genel olarak benzersiz olmalı

az group create -n $RG -l $LOC

az postgres flexible-server create -g $RG -n $DB -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 17 \
  --admin-user pitcharena --admin-password '<GÜÇLÜ-PAROLA>' \
  --database-name pitcharena --public-access 0.0.0.0

az appservice plan create -g $RG -n pitcharena-plan --is-linux --sku B1
az webapp create -g $RG -p pitcharena-plan -n $APP --runtime "NODE:22-lts"
az webapp config set -g $RG -n $APP --always-on true --startup-file "node server.js"

az webapp config appsettings set -g $RG -n $APP --settings \
  DATABASE_URL="postgresql://pitcharena:<PAROLA>@$DB.postgres.database.azure.com:5432/pitcharena?sslmode=verify-full" \
  GEMINI_API_KEY="<anahtar>" \
  NODE_ENV=production \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false   # hazır paket gönderiyoruz, Oryx yeniden derlemesin
```

### Migration'lar

Deploy iş akışı migration çalıştırmaz: GitHub runner'ının IP'si veritabanı güvenlik
duvarında tanımlı değildir ve her koşuda değişir. Şemayı kendi makinenden uygula:

```bash
az postgres flexible-server firewall-rule create -g $RG -n $DB \
  --rule-name yerel --start-ip-address <IP> --end-ip-address <IP>

DATABASE_URL="postgresql://...azure.com:5432/pitcharena?sslmode=verify-full" npm run db:deploy
```

### SSL neden `verify-full`

Azure Postgres şifreli bağlantı zorunlu tutar. `sslmode=require` yazmak yanıltıcı olurdu:
kullandığımız `pg` sürümü `uselibpqcompat` verilmediğinde `require`'ı zaten `verify-full`
gibi işler, üstelik her açılışta bir deprecation uyarısı basar. Niyeti açık yazmak hem
uyarıyı susturur hem de sertifika doğrulamasının gerçekten yapıldığını belgeler.

Ek bir kök sertifika dosyası gerekmez: Azure'un zinciri (DigiCert Global Root G2,
Microsoft RSA Root CA 2017) Node'un gömülü sertifika deposunda mevcuttur.

### GitHub secret

```bash
az webapp deployment list-publishing-profiles -g $RG -n $APP --xml
```

Çıktıyı repo ayarlarında `AZURE_WEBAPP_PUBLISH_PROFILE` secret'ı olarak kaydet. Ardından
aynı ayarlarda `AZURE_READY` **değişkenini** `true` yap — deploy işi bu bayrak açılana kadar
atlanır, böylece kaynaklar hazır değilken iş akışı boşuna kırmızı yanmaz.

Bu ikisi tamamlandığında `master`'a her push `.github/workflows/deploy.yml` iş akışını
tetikler.

> Publish profile parola tabanlıdır. Uzun ömürlü kurulumda federated credential (OIDC) ile
> `azure/login@v2` kullanmak daha doğrudur; secret rotasyonu ortadan kalkar.
