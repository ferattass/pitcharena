import { cookies } from "next/headers";
import { PROFILE_COOKIE, parseProfile, type Profile } from "./profile";

/**
 * Profilin sunucu tarafındaki tek okuma yüzeyi.
 *
 * `next/headers` yalnızca sunucuda çalışır; saf yardımcılardan (lib/profile.ts)
 * ayrı durmak zorunda, çünkü onları istemci bileşeni de kullanıyor. Aynı
 * dosyada olsalardı `cookies` istemci paketine sürüklenir ve derleme patlardı —
 * lint ve typecheck bunu yakalamıyor, ancak sayfa açılınca 500 veriyor.
 */
export async function readProfile(): Promise<Profile> {
  const store = await cookies();
  return parseProfile(store.get(PROFILE_COOKIE)?.value);
}
