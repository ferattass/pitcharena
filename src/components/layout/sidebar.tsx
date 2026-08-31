"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  FolderOpen,
  Gem,
  LayoutGrid,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Tek kaynak: gezinme etiketleri. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel", icon: LayoutGrid },
  { href: "/analysis", label: "Yeni analiz", icon: Compass },
  { href: "/simulation", label: "Yatırımcı simülasyonu", icon: BarChart3 },
  { href: "/trends", label: "Pazar eğilimleri", icon: TrendingUp },
  { href: "/reports", label: "Kayıtlı raporlar", icon: FolderOpen },
  { href: "/settings", label: "Ayarlar", icon: Settings },
] as const;

export function Sidebar({ quota }: { quota: { used: number; limit: number; remaining: number } }) {
  const pathname = usePathname();
  const percent = quota.limit > 0 ? (quota.remaining / quota.limit) * 100 : 0;

  return (
    <aside className="sidebar-sheen sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/10 md:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 py-7 text-white"
      >
        <span className="grid size-8 place-items-center rounded-xl bg-electric-500 text-white shadow-[0_8px_20px_rgb(30_94_255_/_0.35)]"><Gem className="size-4" aria-hidden /></span>
        <span><span className="block text-[15px] font-bold tracking-tight">PitchArena</span><span className="mt-0.5 block text-[10px] font-medium tracking-[0.16em] text-electric-200 uppercase">Investment OS</span></span>
      </Link>

      <nav aria-label="Ana menü" className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.16)]"
                  : "text-navy-200 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3.5 backdrop-blur-sm">
          <p className="text-xs font-semibold text-white">Analiz kapasitesi</p>
          <p className="mt-1 text-[11px] leading-relaxed text-navy-300">
            Bugün kalan analiz hakkı
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">{quota.remaining}</span>
            <span className="text-[11px] text-navy-300">/ {quota.limit}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-electric-400 to-cyan-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
