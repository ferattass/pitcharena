# Demo ve Sunum Betiği

> Hedef süre: **6 dakika demo + 2 dakika soru**. Provası yapılmıştır (18.08.2026):
> replay ~30 saniyede tamamlanıyor, konsol 0 hata / 0 uyarı.

---

## 1. Sahneye çıkmadan 10 dakika önce

```bash
npm run build && npm start      # dev değil: Next dev rozeti ekranda görünmesin
```

- [ ] `http://localhost:3000/analysis` açık, listede **demo rozetli 3 analiz** görünüyor
      (yoksa: `npm run db:seed`)
- [ ] Demo analizini bir kez replay ile aç, sonuna kadar akıt — tarayıcı önbelleği ısınsın
- [ ] Sunum sekmesi dışındaki her şeyi kapat, bildirimleri sustur
- [ ] Yedek: telefonda demo videosu hazır

**Neden `npm start`?** Dev sunucuda sol altta "Next.js Dev Tools" rozeti duruyor ve derleme
sırasında sayfa takılabiliyor. Üretim derlemesi hem temiz hem hızlı, üstelik Azure'da
çalışacak olanın birebir aynısı.

---

## 2. Akış

### 0:00 — Problem (konuş, ekran yok)

> "Fikrinizi ChatGPT'ye sorun. Size ne diyecek? 'Harika fikir.' Modeller onaylamaya
> eğilimli. Bu bir ürün değil, bir ayna."

### 0:30 — İçgörü

> "Değer tek bir cevapta değil. Değer, **cevapların çeliştiği** yerde.
> Ben de teşvikleri birbirine zıt 11 ajan kurdum. Birinin işi fikri öldürmek,
> birinin işi savunmak."

### 1:00 — Canlı akış (`/analysis` → demo analizini aç → **Tekrar oynat**)

Ekranda ajanlar sırayla düşünmeye başlar. Konuşurken bırak aksın:

> "Tur 1'de beş ajan **birbirini görmeden** çalışıyor. Körlük kasıtlı — birbirlerini
> görselerdi aynı şeyi söylerlerdi."

### 2:00 — 🎯 Çapraz sorgu (ürünün kalbi)

Kırmızı **SALDIRI** kartları ile yeşil **SAVUNMA** kartlarının karşılıklı açıldığı yer.
Burada dur, bir saldırıyı yüksek sesle oku:

> "Şüpheci yatırımcı diyor ki: *'Ödeme isteği doğrulanmamış — kullanıcılar bu sorunu
> bugün ücretsiz araçlarla çözüyor.'* Kurucu avukatı karşılık veriyor ve bir **pivot**
> öneriyor. Bu iki çıktı ayrı çağrılar, ayrı bağlamlar. Tek promptta 'beş uzman gibi
> davran' demek sahte çeşitliliktir."

### 3:00 — Anlaşmazlık endeksi

Üç yatırımcı kartını göster: **TAKİPTE / GEÇER / TAKİPTE** — anlaşmazlık **50**.

> "Üç yatırımcı aynı fikre üç farklı tezle baktı ve **anlaşamadılar**. Bunu bir hata
> olarak saklamıyorum, ölçüp ekrana basıyorum. Ürünün tezi tam olarak bu."

### 4:00 — Karar ve muhalefet şerhi

> "Çıktı bir özet değil, bir **komite tutanağı**: karar GO-IF, üç koşul yazılı,
> ve **muhalefet şerhi** — karara karşı çıkan görüş, zayıflatılmadan tutanağa geçmiş."

Sağdaki "Bu kararı değiştirecek 3 şey" kutusunu göster:

> "Kullanıcı buradan çıkıp ne yapacağını biliyor. Fikri revize edip tekrar çalıştırdığında
> skor farkını görüyor."

### 5:00 — Mühendislik (30 saniye, hızlı)

> "Orkestratör bellekte durum tutmaz — her ajan çıktısı anında veritabanına yazılır.
> Sonuç: tarayıcı kapansa analiz sürer, sayfa yenilenince akış kaldığı yerden devam eder,
> ve her analiz **birebir tekrar oynatılabilir**. Az önce izlediğiniz şey de buydu."

### 5:30 — Olgunluk (kapanış)

> "Gemini kotası biterse sistem simülasyon sağlayıcısına düşer ve ürün ayakta kalır —
> ekranda da açıkça rozetlenir. Kota koruması, gizlilik uyarısı, CI/CD ve Azure deploy var.
> Bu bir demo değil, çalışan bir sistem."

---

## 3. Jüri soruları — hazır cevaplar

**"Bu ChatGPT'ye beş kez sormaktan farklı ne?"**
Ajanlar ayrı çağrılar, ayrı bağlamlar ve **zıt teşvikler** taşıyor. Tur 1 kör, Tur 2
adversaryal, Tur 3 üç farklı yatırım tezi. Üstüne genel puanı model değil **yazılı bir
formül** hesaplıyor (`src/lib/scoring.ts`) — aynı girdi her zaman aynı puanı verir.

**"Halüsinasyon riski?"**
Her ajanın çıktısı Zod şemasıyla doğrulanıyor; şemaya uymayan cevap kabul edilmiyor,
yeniden isteniyor. Skorlar modele bırakılmıyor. Kaynaklandırma (Google Search grounding)
ücretsiz katmanda kapalı ve bunu **arayüzde saklamıyoruz** — "kaynaklandırma olmadan
çalıştı" notu görünür.

**"Verilerimiz nereye gidiyor?"**
Fikir metni Google'a gönderiliyor ve ücretsiz katmanda model eğitiminde kullanılabilir.
Fikir girişinin altında bu açıkça yazıyor: gizli veya patentlenmemiş fikir girilmemeli.

**"Maliyet?"**
Analiz başına 11-14 çağrı, Gemini ücretsiz katman. Dakika başı çağrı sınırı, 429'da üstel
geri çekilme, günlük analiz sınırı ve aynı fikir için hash tabanlı önbellek var.

**"Sunum sırasında API çökerse?"**
Çökebilir, o yüzden buna hazırlandım. `GEMINI_API_KEY` yoksa simülasyon sağlayıcısı devreye
girer; orkestratör, akış, skorlama, rapor — hepsi çalışır. Ayrıca kayıtlı analizler
birebir replay edilebilir. **Şu an izlediğiniz demo zaten replay.**

**"Neden LangChain kullanmadın?"**
Soyutlama katmanı hata ayıklamayı zorlaştırır ve sürüm kırılmaları risk. Dört turluk durum
makinesini kendim yazdım — 343 satır, okunabilir, test edilebilir.

**"Model kimlikleri değişirse?"**
Değişti bile: `gemini-2.5-flash` proje sırasında yeni hesaplara kapatıldı, Google listelemeye
devam ediyor ama çağrıda 404 dönüyor. Her rol için yedek model zinciri var
(`src/lib/agents/meta.ts`); birincil kapalıysa orkestratör sıradakine geçiyor ve kullanılan
modeli kayda yazıyor.

**"Neyi yapamadın?"** *(dürüst ol, bu güven kazandırır)*
Kimlik doğrulama yok — analizler kullanıcıya bağlı değil, kota kurulum genelinde.
PDF memo dışa aktarımı ve public paylaşım linki yapılmadı. Grounding ücretsiz katmanda
çalışmıyor. Üçü de bilinçli kesme kararıydı; öncelik canlı akış, adversaryal tur ve demo
modunun kusursuz çalışmasıydı.

---

## 4. Bir şey patlarsa

| Sorun | Ne yap |
|---|---|
| Sayfa açılmıyor | Yedek sekmede zaten açık olan replay'e geç |
| Replay takıldı | Sayfayı yenile — akış `Last-Event-ID` ile kaldığı yerden devam eder |
| Veritabanı gitti | Telefondaki demo videosuna geç, anlatmaya devam et |
| Canlı analiz denemesi uzadı | **Denemeyi baştan yapma.** Demo replay üstünden anlatılır; canlı analiz ~3-4 dakika sürer, sahnede yeri yok |

**Altın kural:** sahnede **yeni analiz başlatma**. Ücretsiz katmanda 11 çağrı 3-4 dakika
sürer ve 503 riski taşır. Demo replay üzerinden anlatılır; canlı çalıştığını kanıtlaman
gerekirse sunumdan önce başlatıp sekmede hazır beklet.
