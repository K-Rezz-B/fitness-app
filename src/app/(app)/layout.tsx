import { Sidebar, TabBar, Fab } from "@/components/nav";
import { requireAuth } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireAuth();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="pt-safe min-w-0 flex-1 pb-28 md:pb-10">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 md:py-8">{children}</div>
      </main>
      <Fab />
      <TabBar />
    </div>
  );
}
