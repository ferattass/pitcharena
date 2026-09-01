"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_PROFILE,
  NAME_MAX,
  PROFILE_COOKIE,
  PROFILE_COOKIE_MAX_AGE,
  ROLE_MAX,
  clean,
  serializeProfile,
} from "./profile";

export interface ProfileFormState {
  error: string | null;
  savedAt: number | null;
}

/**
 * Profili kaydeder.
 *
 * Çerez yazmak yalnızca Server Action ya da Route Handler içinde mümkün
 * (bkz. next/dist/docs/.../cookies.md), bu yüzden kayıt buradan geçiyor.
 * `httpOnly` bilerek KAPALI değil — açık: profil bir sır değil ama istemci
 * tarafında da okunmasına ihtiyaç yok, sunucu render'ı yeterli.
 */
export async function saveProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const name = clean(formData.get("name"), NAME_MAX);
  const role = clean(formData.get("role"), ROLE_MAX);

  if (!name) {
    return { error: "İsim boş olamaz.", savedAt: null };
  }

  const store = await cookies();
  store.set(PROFILE_COOKIE, serializeProfile({ name, role: role || DEFAULT_PROFILE.role }), {
    path: "/",
    maxAge: PROFILE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });

  // Profil düzeni (topbar) her sayfada olduğu için tüm yerleşim tazelenmeli.
  revalidatePath("/", "layout");

  return { error: null, savedAt: Date.now() };
}
