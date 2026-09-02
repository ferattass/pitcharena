<div align="center">

# 🏛️ PitchArena

### *Fikrinize katılan bir yapay zeka değil. Fikrinizi **savunmak zorunda kaldığınız** bir arena.*

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-2.0_%26_3.6-8E75C2?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

<p align="center">
  <b>11 Farklı Yapay Zeka Ajanı</b> • <b>4 Aşamalı Karar Mekanizması</b> • <b>Gerçek Zamanlı SSE Akışı</b> • <b>Yatırım Komitesi Tutanağı</b>
</p>

[✨ Temel Özellikler](#-temel-özellikler) • [🏛️ 11 Ajan Kadrosu](#️-11-bağımsız-ajan-kadrosu) • [📐 Mimari ve Akış](#-orkestrasyon-mimarisi) • [🚀 Hızlı Başlangıç](#-hızlı-başlangıç) • [📊 Skorlama ve Endeks](#-skorlama-ve-anlaşmazlık-endeksi) • [☁️ Azure Dağıtımı](#️-azure-üretim-dağıtımı)

---

</div>

## 💡 Neden PitchArena?

Tek bir LLM'e *"Bu girişim fikri nasıl?"* diye sorarsanız, doğası gereği bir **"yes-man"** gibi davranıp fikri över, riskleri önemsizleştirir ve kör noktaları gizler.

**PitchArena**, tekil ve yüzeysel bir onay yerine **teşvikleri ve çıkarları birbirine taban tabana zıt 11 uzman ajanı** 4 tur boyunca karşı karşıya getirir. Bir özet veya övgü yerine; bağımsız araştırmalar, çapraz sorgular, 3 farklı fon tezinin kararı ve muhalefet şerhleriyle donatılmış somut bir **Yatırım Komitesi Tutanağı** üretir.

```
                  ┌──────────────────────────────────────────────┐
                  │          GİRİŞİMCİNİN SUNDUĞU FİKİR          │
                  └──────────────────────┬───────────────────────┘
                                         │
     ┌───────────────────────────────────┴───────────────────────────────────┐
     ▼                                   ▼                                   ▼
┌─────────┐                         ┌─────────┐                         ┌─────────┐
│ PAZAR   │                         │  RİSK   │                         │İŞ MODELİ│  ... (5 Ajan)
└────┬────┘                         └────┬────┘                         └────┬────┘
     └───────────────────────────────────┼───────────────────────────────────┘
                                         ▼
                     ┌───────────────────────────────────────┐
                     │    TUR 2: ÇAPRAZ SORGU & SALDIRI      │
                     │  Şüpheci Yatırımcı ⚔️ Kurucu Avukatı   │
                     └───────────────────┬───────────────────┘
                                         ▼
                     ┌───────────────────────────────────────┐
                     │    TUR 3: YATIRIMCI SİMÜLASYONU       │
                     │    Melek  •  Seri A  •  Kurumsal CVC  │
                     └───────────────────┬───────────────────┘
                                         ▼
                     ┌───────────────────────────────────────┐
                     │       TUR 4: KOMİTE SENTEZİ           │
                     │  GO / GO-IF / NO-GO + Muhalefet Şerhi │
                     └───────────────────────────────────────┘
```

---

## ✨ Temel Özellikler

- **🎭 Teşvik Çatışması Odaklı Tasarım:** Ajanlar "yardımsever asistan" değildir; her biri kendi çıkarını maksimize etmeye programlanmıştır (örn. Rakip Avcısı *"bu zaten var"* demeye, Şüpheci Yatırımcı *fikri öldürmeye*, Kurucu Avukatı *savunmaya* odaklanır).
- **📡 Server-Sent Events (SSE) Canlı Akış:** Ajanların düşünme süreçleri, argümanları ve kararları istemciye canlı olarak akar.
- **📼 Deterministik Replay (Tekrar Oynatma):** Yapılan her analiz, saniyesi saniyesine ve olay sırasına göre sonradan birebir tekrar oynatılabilir (`/analysis/[id]?replay=1`).
- **🛡️ Sıfır Kesinti & Akıllı Düşme (Resilience):**
  - Model kapalıysa sıradaki fallback modeline geçer (`gemini-3.5-flash-lite` ➔ `gemini-3.5-flash` ➔ `gemini-3.6-flash`).
  - Google API kotası biterse veya anahtarsız çalıştırılırsa **Simülasyon Motoruna** düşer; demo ve sunumlar asla 500 hatasıyla kesilmez.
  - Veritabanı bağlantısı koparsa analizler **Bellek İçi (Offline)** modda kesintisiz tamamlanır.
- **⚖️ Matematiksel Skorlama & Anlaşmazlık Endeksi:** Puanlar LLM'in keyfine bırakılmaz; 5 boyutun formüllü ağırlıklı ortalaması ve yatırımcıların standart sapmasından türetilen **Anlaşmazlık Endeksi (0-100)** hesaplanır.
- **📁 Data Room / Kanıt Desteği:** Kurucu pazar araştırması, traction veya finansal kanıtlar yükleyerek ajanların gerçek verileri önceliklendirmesini sağlayabilir.

---

## 🏛️ 11 Bağımsız Ajan Kadrosu

| Tur | Ajan | Rol / Teşvik | Odaklandığı Metrik / Soru | Sağlayıcı / Durum |
|:---:|:---|:---|:---|:---:|
| **1** | **Pazar Analisti** | Sayı bulmak & pazar boyutlandırmak | TAM / SAM / SOM, CAGR, Neden şimdi? | *Grounded Web Search* |
| **1** | **Rakip Avcısı** | «Bu zaten var» diyebilmek | Doğrudan & dolaylı rakipler, Excel/WhatsApp ikameleri | *Grounded Web Search* |
| **1** | **Teknik Fizibilite** | Gerçek zorluğu ölçmek | MVP kapsamı, teknik borç, kişi-ay efor tahmini | *LLM Analysis* |
| **1** | **İş Modeli & Birim Ekonomi** | «Para nereden geliyor?» | Fiyatlandırma, CAC, LTV, LTV/CAC, En zayıf varsayım | *LLM Analysis* |
| **1** | **Risk & Regülasyon** | Tehlike bulmak | KVKK/GDPR, tek tedarikçi bağımlılığı, Moat analizi | *LLM Analysis* |
| **2** | **Şüpheci Yatırımcı** | **Fikri öldürmek** | 18 ayda batış senaryosu, Tur 1 açıklarına 3-5 sert saldırı | *Debate Engine* |
| **2** | **Kurucu Avukatı** | **Fikri savunmak** | Kanıtla çürütme (Evidence), Kapsam daraltma (Pivot), Kabul (Concede) | *Debate Engine* |
| **3** | **Melek Yatırımcı** | Erken aşama tezi | *«Ekip ve zamanlama > metrik»* (25k - 250k USD) | *Investor Decision* |
| **3** | **Seri A Yatırımcısı** | Büyüme & ölçek tezi | *«Traction olmadan hikaye yok»* (2M - 8M USD) | *Investor Decision* |
| **3** | **Kurumsal CVC** | Stratejik sinerji tezi | *«Bizim dağıtım kanalımıza uyar mı?»* (1M - 5M USD) | *Investor Decision* |
| **4** | **Yatırım Komitesi Başkanı** | Anlaşmazlığı tutanağa geçirmek | **GO / GO-IF / NO-GO**, Muhalefet Şerhi, Kararı Değiştirecek 3 Olay | *Committee Synthesis* |

---

## 📐 Orkestrasyon Mimarisi

Orkestratör **durumsuz (stateless)** olarak çalışır; tüm durum veritabanındaki `AgentRun` ve `Event` tablolarında tutulur. Tarayıcı kapansa veya bağlantı kopsa dahi analiz arka planda devam eder.

```mermaid
sequenceDiagram
    autonumber
    actor Founder as 👤 Kurucu
    participant API as ⚡ API Route
    participant Orch as 🧠 Orkestratör
    participant Tur1 as 📊 Tur 1 (5 Paralel Ajan)
    participant Tur2 as ⚔️ Tur 2 (Çapraz Sorgu)
    participant Tur3 as 💼 Tur 3 (3 Yatırımcı)
    participant Tur4 as 📜 Tur 4 (Komite Başkanı)
    participant DB as 🗄️ PostgreSQL / State
    actor Client as 💻 SSE İstemcisi

    Founder->>API: POST /api/analyses (Fikir + Kanıtlar)
    API->>DB: Analysis oluştur (QUEUED)
    API-->>Founder: { id: "..." }
    Orch->>DB: Durumu RUNNING yap
    
    par Tur 1 Paralel Yürütme
        Orch->>Tur1: Pazar, Rakip, Fizibilite, İş Modeli, Risk
        Tur1->>DB: Boyut puanları ve bulguları kaydet
        Tur1-->>Client: SSE: round.completed (Tur 1)
    end

    critical Tur 2 Sıralı Yürütme
        Orch->>Tur2: Şüpheci Yatırımcı (Fikri Öldür)
        Tur2->>DB: 3-5 Saldırı kaydet
        Orch->>Tur2: Kurucu Avukatı (Saldırıları Yanıtla)
        Tur2->>DB: Rebuttals & Pivot önerisi kaydet
        Tur2-->>Client: SSE: round.completed (Tur 2)
    end

    par Tur 3 Yatırımcı Kararları
        Orch->>Tur3: Melek, Seri A ve CVC bağımsız kararları
        Tur3->>DB: Kararlar (INVEST / FOLLOW_UP / PASS)
        Tur3-->>Client: SSE: round.completed (Tur 3)
    end

    Orch->>Tur4: Komite Başkanı Sentezi
    Tur4->>DB: Nihai Karar, Memo, Muhalefet Şerhi & Skorlar
    Orch->>DB: Durumu COMPLETED yap
    Orch-->>Client: SSE: analysis.completed
```

---

## 📊 Skorlama ve Anlaşmazlık Endeksi

### 1. 5 Boyutlu Ağırlıklı Genel Puan (0-100)
Ajanlar boyut puanını verir; genel puan sistem tarafından ağırlıklı formülle hesaplanır:
$$\text{Genel Puan} = (0.25 \times \text{Pazar}) + (0.20 \times \text{Rekabet}) + (0.20 \times \text{Fizibilite}) + (0.20 \times \text{İş Modeli}) + (0.15 \times \text{Risk})$$

### 2. Anlaşmazlık Endeksi (Disagreement Index) (0-100)
Üç yatırımcının (Melek, Seri A, CVC) verdiği kararlar arasındaki **standart sapmayı** ölçer:

$$\text{INVEST} = 100 \quad | \quad \text{FOLLOW\_UP} = 50 \quad | \quad \text{PASS} = 0$$

* **0 Endeks (Güçlü Fikir Birliği):** Üç yatırımcı da aynı kararı verdiğinde (örn. üçü de `PASS` veya üçü de `INVEST`).
* **50 Endeks (Kısmi Ayrışma):** İki yatırımcı aynı, biri farklı düşündüğünde.
* **100 Endeks (Tartışmalı Fikir):** Yatırımcılar en uç zıtlıklara ayrıştığında (`INVEST`, `PASS`, `FOLLOW_UP`).

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- **Node.js:** v20.6+ veya v22 LTS
- **Docker** (Yerel PostgreSQL için)
- *(İsteğe Bağlı)* **Google Gemini API Key** (Ücretsiz katman anahtarı yeterlidir)

### 1. Depoyu Klonlayın ve Bağımlılıkları Yükleyin
```bash
git clone https://github.com/ferattass/pitcharena.git
cd pitcharena
npm install
```

### 2. Veritabanını Başlatın (Docker)
```bash
docker run -d --name pitcharena-db \
  -e POSTGRES_USER=pitcharena \
  -e POSTGRES_PASSWORD=pitcharena \
  -e POSTGRES_DB=pitcharena \
  -p 127.0.0.1:5433:5432 \
  postgres:18-alpine
```

### 3. Ortam Değişkenlerini Ayarlayın
`.env.example` dosyasını `.env` olarak kopyalayın:
```bash
cp .env.example .env
```

```env
# Veritabanı
DATABASE_URL="postgresql://pitcharena:pitcharena@127.0.0.1:5433/pitcharena?schema=public"

# Gemini LLM (Boş bırakılırsa simülasyon sağlayıcısı devreye girer)
GEMINI_API_KEY="AIzaSy..."

# Hız ve Kota Koruması
GEMINI_RPM_LIMIT="10"
DAILY_ANALYSIS_LIMIT="20"
```

### 4. Şemayı Senkronize Edin ve Başlatın
```bash
# Veritabanı tablolarını oluştur
npm run db:migrate

# (İsteğe bağlı) Hazır demo analizlerini yükle
npm run db:seed

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcınızda **`http://localhost:3000`** adresine gidin.

---

## 🛠️ Komutlar & Geliştirici Araçları

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusunu Turbopack ile başlatır |
| `npm run build` | Üretim derlemesi alır ve standalone sunucuyu hazırlar (`scripts/assemble-standalone.mjs`) |
| `npm start` | Standalone üretim sunucusunu çalıştırır |
| `npm test` | Vitest ile birim ve sözleşme testlerini çalıştırır |
| `npm run smoke` | 11 ajanı veritabanına karşı uçtan uca test eden duman testi |
| `npm run typecheck` | Next.js typegen ve strict TypeScript doğrulaması |
| `npm run lint` | ESLint 9 kontrolleri |
| `npm run db:migrate` | Prisma migration oluşturur ve yerel DB'ye uygular |
| `npm run db:seed` | Canlı replay yapılabilir örnek analizleri DB'ye yazar |
| `npm run db:studio` | Prisma Studio veri tarayıcısını açar |

---

## 📂 Proje Yapısı

```
pitcharena/
├── src/
│   ├── app/                     # Next.js App Router sayfaları ve layoutlar
│   │   ├── (app)/               # Dashboard, New Analysis, Reports, Settings
│   │   │   ├── analysis/[id]/   # Canlı akış ve detay ekranı
│   │   │   ├── reports/         # Geçmiş rapor arşivi
│   │   │   └── settings/        # Sağlayıcı ve kota yönetim paneli
│   │   └── api/analyses/        # REST ve SSE streaming endpointleri
│   ├── components/              # UI bileşenleri (Recharts, Badge, Modal, Tabs)
│   ├── lib/
│   │   ├── agents/              # 11 Ajan tanımı, Zod şemaları, Promptlar
│   │   ├── llm/                 # Gemini Provider, Rate Limiter, Simülasyon Motoru
│   │   ├── orchestrator/        # Durum makinesi, Event emit & SSE kuyruk yönetimi
│   │   ├── scoring.ts           # Ağırlıklı skor & Anlaşmazlık endeksi matematiği
│   │   ├── offline-analyses.ts  # DB kesintilerinde bellek içi çalışma katmanı
│   │   └── db.ts                # Prisma 7 PostgreSQL Client Adaptörü
│   └── generated/prisma/        # Optimize Prisma Client çıktıları
├── prisma/
│   ├── schema.prisma            # Analysis, AgentRun, Score, Citation, Event modelleri
│   └── migrations/              # Sürüm kontrollü SQL göç dosyaları
└── docs/
    └── PLAN.md                  # Ürün tezi, hedefler ve mimari tasarım kararları
```

---

## ☁️ Azure Üretim Dağıtımı

Uygulama, arka planda asenkron orkestrasyon yürüttüğü için kesintisiz **B1 (Basic)** veya üzeri bir App Service planında çalıştırılmalıdır *(F1 ücretsiz planlar boşta kalınca orkestratörü askıya alabilir)*.

### Hızlı Azure Kurulumu
```bash
# Kaynak Grubu ve Veritabanı
az group create -n pitcharena-rg -l westeurope
az postgres flexible-server create -g pitcharena-rg -n pitcharena-db -l westeurope \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 17 \
  --admin-user pitcharena --admin-password '<PAROLA>' \
  --database-name pitcharena --public-access 0.0.0.0

# App Service Plan ve Web App
az appservice plan create -g pitcharena-rg -n pitcharena-plan --is-linux --sku B1
az webapp create -g pitcharena-rg -p pitcharena-plan -n pitcharena-app --runtime "NODE:22-lts"
az webapp config set -g pitcharena-rg -n pitcharena-app --always-on true --startup-file "node server.js"

# Ortam Değişkenleri
az webapp config appsettings set -g pitcharena-rg -n pitcharena-app --settings \
  DATABASE_URL="postgresql://pitcharena:<PAROLA>@pitcharena-db.postgres.database.azure.com:5432/pitcharena?sslmode=verify-full" \
  GEMINI_API_KEY="<GEMINI_KEY>" \
  NODE_ENV=production
```

---

## 🔒 Gizlilik ve Sorumluluk Reddi

> [!WARNING]
> **Gizlilik Notu:** Analiz sırasında girilen fikir metinleri Google Gemini API'ye iletilir. Ücretsiz katman kullanımında veriler model eğitiminde kullanılabilir. Patent başvurusu yapılmamış veya ticari sır niteliğindeki hassas veriler sisteme girilmemelidir.

---

<div align="center">

Geliştirici: **[Ferat Taş](https://github.com/ferattass)**  
*Girişim fikirlerini doğrulamak, zayıflıkları bulmak ve daha güçlü şirketler kurmak için tasarlandı.*

</div>
