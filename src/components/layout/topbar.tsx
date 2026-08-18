import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SearchBox } from "./search-box";

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-hairline bg-card px-6">
      <div className="ml-auto w-full max-w-xs">
        <SearchBox />
      </div>

      <ButtonLink href="/analysis" variant="primary" size="sm" className="shrink-0">
        <Plus className="size-4" aria-hidden />
        Yeni analiz
      </ButtonLink>

      <div className="flex items-center gap-2.5 border-l border-hairline pl-4">
        <div
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-navy-800 text-xs font-semibold text-white"
        >
          MD
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-[13px] font-semibold text-navy-900">Mustafa Doğan</p>
          <p className="text-[11px] text-navy-400">Kurucu</p>
        </div>
      </div>
    </header>
  );
}
