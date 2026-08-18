import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { quotaStatus } from "@/lib/analysis";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const quota = await quotaStatus();

  return (
    <div className="flex min-h-dvh">
      <Sidebar quota={quota} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10">
          <Topbar />
        </div>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
