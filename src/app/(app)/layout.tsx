import { Suspense } from "react";
import { signOut } from "@/auth";
import { requireUser } from "@/server/auth-guard";

// Every route in (app) requires a signed-in, allowlisted user. The session is
// read from cookies, so under Cache Components it must sit inside Suspense.
// Phase 2 replaces the top bar with the full sidebar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <span className="font-semibold">WorkManager</span>
        <div className="flex items-center gap-3 text-sm">
          {user.role === "admin" && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Admin
            </span>
          )}
          <span className="text-muted">{user.email}</span>
          <form action={signOutAction}>
            <button className="rounded-md px-2 py-1 hover:bg-background">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
