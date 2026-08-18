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
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-card md:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 py-6 text-navy-900"
      >
        <Gem className="size-5 text-electric-500" aria-hidden />
        <span className="text-[15px] font-bold tracking-tight">PitchArena</span>
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-electric-500 text-white shadow-card"
                  : "text-navy-600 hover:bg-navy-50 hover:text-navy-900",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-xl bg-navy-50 p-3.5">
          <p className="text-xs font-semibold text-navy-800">Ücretsiz katman</p>
          <p className="mt-1 text-[11px] leading-relaxed text-navy-500">
            Bugün kalan analiz hakkı
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-bold text-navy-900">{quota.remaining}</span>
            <span className="text-[11px] text-navy-400">/ {quota.limit}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-navy-200">
            <div
              className="h-full rounded-full bg-electric-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
