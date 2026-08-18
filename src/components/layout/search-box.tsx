"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Kayıtlı raporlarda fikir metni ve başlık üzerinde arama.
 *
 * Kasten `useSearchParams` kullanmıyor: bileşen her sayfada görünen
 * yerleşimde duruyor ve o hook tüm ağacı Suspense sınırına zorluyor.
 */
export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/reports?q=${encodeURIComponent(query)}` : "/reports");
  }

  return (
    <form onSubmit={submit} role="search" className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-300"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Analizlerde ara…"
        aria-label="Analizlerde ara"
        className="h-9 w-full rounded-lg bg-navy-50 pr-3 pl-9 text-sm text-navy-900 placeholder:text-navy-400 focus:bg-card focus:ring-2 focus:ring-electric-200 focus:outline-none"
      />
    </form>
  );
}
