/**
 * Kurucu profili.
 *
 * Ürünün henüz kimlik doğrulaması yok; `User` tablosu şemada duruyor ama hiçbir
 * oturuma bağlı değil. Profili çereze yazıyoruz çünkü tek gereken bu: sunucu
 * bileşeni ilk render'da doğru adı basabiliyor (istemci tarafı bir depo olsaydı
 * önce varsayılan görünüp sonra zıplardı) ve kayıt, veritabanı kapalıyken de
 * tarayıcı yeniden açıldığında duruyor.
 *
 * Kimlik doğrulama geldiğinde buranın yerini `User` kaydı alır; okuma yüzeyi
 * (`readProfile`) aynı kaldığı için çağıran taraflar değişmez.
 */
export interface Profile {
  name: string;
  role: string;
}

export const PROFILE_COOKIE = "pitcharena_profile";

export const DEFAULT_PROFILE: Profile = { name: "Kurucu", role: "PitchArena" };

export const NAME_MAX = 40;
export const ROLE_MAX = 40;

/** Çerez bir yıl yaşar; demo arası tarayıcı kapansa da profil durur. */
export const PROFILE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Addan avatar baş harfleri.
 *
 * Eskiden baş harfler ("MD") isimden bağımsız sabit yazılıydı; isim
 * değiştiğinde uyumsuz kalıyordu. Artık tek kaynak isim.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join("").toLocaleUpperCase("tr-TR");
}

/** Çerezden gelen ham değeri güvenli bir profile indirger. */
export function parseProfile(raw: string | undefined): Profile {
  if (!raw) return DEFAULT_PROFILE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PROFILE;

    const { name, role } = parsed as Record<string, unknown>;
    return {
      name: clean(name, NAME_MAX) || DEFAULT_PROFILE.name,
      role: clean(role, ROLE_MAX) || DEFAULT_PROFILE.role,
    };
  } catch {
    // Çerez elle kurcalanmış olabilir; bozuk değer ekranı bozmasın.
    return DEFAULT_PROFILE;
  }
}

export function serializeProfile(profile: Profile): string {
  return JSON.stringify(profile);
}

/** Girdiyi kırpar, satır sonlarını atar ve sınıra sığdırır. */
export function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
