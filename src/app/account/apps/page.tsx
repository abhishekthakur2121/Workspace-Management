import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Plug } from "lucide-react";
import { requireUser } from "@/server/auth-guard";
import { getConnectedApps } from "@/server/queries/connected-apps";
import { endpoints, originOf } from "@/server/oauth/config";
import { ConnectorAddress, DisconnectButton } from "@/components/account/connected-apps";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Connected apps" };

// Apps the person has allowed to work as them (through /api/mcp), how to
// connect one, and a way to disconnect each.
export default function ConnectedAppsPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-lg rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <h1 className="text-2xl font-semibold">Connected apps</h1>
        <p className="mt-1 text-sm text-muted">
          Apps such as Claude that you&apos;ve allowed to use Nxt Workspace Manager as you. They see and change only what you can, can&apos;t
          delete anything, and every change shows in the task history as &ldquo;via&rdquo; the app.
        </p>
        <Suspense fallback={<div className="skeleton mt-6 h-64 rounded-xl" />}>
          <Body />
        </Suspense>
      </div>
    </main>
  );
}

async function Body() {
  const user = await requireUser();
  const [apps, origin] = await Promise.all([getConnectedApps(user.id), headers().then(originOf)]);
  return (
    <>
      <section className="mt-6 rounded-xl bg-background/60 p-4">
        <h2 className="text-sm font-semibold">Connect an app</h2>
        <p className="mt-1 text-sm text-muted">
          In Claude, open <span className="font-medium text-foreground">Settings → Connectors → Add custom connector</span>, paste this address,
          then choose <span className="font-medium text-foreground">Connect</span> and allow access. On a Claude Team or Enterprise plan, an
          owner adds it once for everyone. Other apps that support MCP connectors use the same address.
        </p>
        <ConnectorAddress url={endpoints(origin).resource} />
      </section>

      <h2 className="mt-6 text-sm font-semibold">Your connections</h2>
      {apps.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">No apps connected yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-grid rounded-xl border border-grid">
          {apps.map((app) => (
            <li key={app.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Plug className="size-4" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {app.name}
                  {!app.active && <span className="ml-2 rounded-full bg-hover px-2 py-0.5 text-xs font-normal text-muted">Expired</span>}
                </p>
                <p className="text-xs text-muted">
                  Connected {timeAgo(app.connectedAt)}
                  {" · "}
                  {app.lastUsedAt ? `last used ${timeAgo(app.lastUsedAt)}` : "not used yet"}
                </p>
              </div>
              <DisconnectButton id={app.id} name={app.name} active={app.active} />
            </li>
          ))}
        </ul>
      )}
      {apps.some((a) => !a.active) && (
        <p className="mt-2 text-xs text-muted">Expired connections haven&apos;t been used for 30 days. Connect again from the app to use it.</p>
      )}

      <Link href="/" className="mt-6 inline-block text-sm text-muted hover:text-foreground">
        Back to the app
      </Link>
    </>
  );
}
