import { Sidebar, TabBar, Fab } from "@/components/nav";
import { AppBadge } from "@/components/app-badge";
import { PageTransition } from "@/components/page-transition";
import { OutboxSync } from "@/components/outbox-sync";
import { requireProfile } from "@/lib/session";
import { countThisWeek } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireProfile();
  const remaining = Math.max(0, me.weeklySessionsTarget - (await countThisWeek(me.id)));
  return (
    <div className="flex min-h-dvh">
      <Sidebar profile={{ name: me.name, emoji: me.emoji }} />
      <main className="pt-safe min-w-0 flex-1 pb-28 md:pb-10">
        <PageTransition>{children}</PageTransition>
      </main>
      <Fab />
      <TabBar />
      <AppBadge count={remaining} />
      <OutboxSync pid={me.id} />
    </div>
  );
}
