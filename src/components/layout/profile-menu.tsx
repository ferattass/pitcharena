"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveProfile, type ProfileFormState } from "@/lib/profile-actions";
import { NAME_MAX, ROLE_MAX, initialsOf, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

const EMPTY: ProfileFormState = { error: null, savedAt: null };

/**
 * Topbar'daki kurucu profili — tıklanınca yerinde düzenlenir.
 *
 * Görünen değer sunucudan geliyor (bkz. lib/profile.ts): ilk render doğru adı
 * basar, "Kurucu" yazıp sonra zıplamaz. Kaydetme bir Server Action üzerinden
 * gider, çünkü çerez yalnızca orada yazılabilir.
 */
export function ProfileMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveProfile, EMPTY);
  const containerRef = useRef<HTMLDivElement>(null);

  // Kayıt başarılıysa paneli kapat. Effect yerine render sırasında ayarlıyoruz:
  // bu, React'in "prop değişince state'i düzelt" kalıbı ve zincirleme render
  // doğurmuyor. Her kaydın kendi zaman damgası var, o yüzden tek kez tetiklenir.
  const [handledSave, setHandledSave] = useState<number | null>(null);
  if (state.savedAt && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setOpen(false);
  }

  // Dışarı tıklama ve Esc ile kapansın — küçük bir panel için modal aşırı olur.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "group flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors",
          "hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-electric-500 focus-visible:outline-none",
        )}
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-navy-800 text-xs font-semibold text-white"
        >
          {initialsOf(profile.name)}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-navy-900">{profile.name}</span>
          <span className="block text-[11px] text-navy-400">{profile.role}</span>
        </span>
        <Pencil
          className="hidden size-3 shrink-0 text-navy-300 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Profili düzenle"
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-hairline bg-card p-4 shadow-lift"
        >
          <form action={formAction} className="space-y-3">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-[11px] font-semibold tracking-wide text-navy-400 uppercase"
              >
                İsim
              </label>
              <input
                id="profile-name"
                name="name"
                defaultValue={profile.name}
                maxLength={NAME_MAX}
                autoFocus
                required
                className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] text-navy-900 outline-none focus:border-electric-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-role"
                className="block text-[11px] font-semibold tracking-wide text-navy-400 uppercase"
              >
                Unvan
              </label>
              <input
                id="profile-role"
                name="role"
                defaultValue={profile.role}
                maxLength={ROLE_MAX}
                className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] text-navy-900 outline-none focus:border-electric-500"
              />
            </div>

            {state.error && <p className="text-[12px] text-verdict-nogo">{state.error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                <Check className="size-4" aria-hidden />
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
