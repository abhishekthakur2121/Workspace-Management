import { Suspense } from "react";
import { requireUser } from "@/server/auth-guard";
import { getNavData } from "@/server/queries/nav";
import { AppShell } from "@/components/sidebar/sidebar";

// Every route in (app) requires a signed-in, allowlisted user. The session is
// read from cookies, so under Cache Components it must sit inside Suspense.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = await getNavData(user);

  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex h-dvh">
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface md:block" />
      <div className="flex-1" />
    </div>
  );
}
