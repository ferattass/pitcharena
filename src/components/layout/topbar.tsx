import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { readProfile } from "@/lib/profile-server";
import { ProfileMenu } from "./profile-menu";
import { SearchBox } from "./search-box";

export async function Topbar() {
  const profile = await readProfile();

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-white/70 bg-white/72 px-4 backdrop-blur-xl sm:px-6">
      <div className="ml-auto w-full max-w-xs">
        <SearchBox />
      </div>

      <ButtonLink href="/analysis" variant="primary" size="sm" className="shrink-0">
        <Plus className="size-4" aria-hidden />
        Yeni analiz
      </ButtonLink>

      <div className="border-l border-hairline pl-4">
        <ProfileMenu profile={profile} />
      </div>
    </header>
  );
}
