import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Plug } from "lucide-react";
import { requireUser } from "@/server/auth-guard";
import { getConnectedApps } from "@/server/queries/connected-apps";
import { endpoints, originOf } from "@/server/oauth/config";
import { ConnectorAddress, RevokeButton } from "@/components/account/connected-apps";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Connected apps" };

// Apps the person has authorized to work as them (through /api/mcp), the URL
// to connect one, and a way to revoke each.
export default function ConnectedAppsPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-lg rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <h1 className="text-2xl font-semibold">Connected apps</h1>
        <p className="mt-1 text-sm text-muted">
          Apps you&apos;ve authorized to access your account. An app can only see and change what you can, and it can&apos;t delete
          anything. Changes it makes are labelled with its name in the task history.
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
        <h2 className="text-sm font-semibold">MCP server URL</h2>
        <p className="mt-1 text-sm text-muted">
          To connect an app that supports MCP, add this URL in the app&apos;s connector settings. You&apos;ll be asked to sign in and authorize
          access.
        </p>
        <ConnectorAddress url={endpoints(origin).resource} />
      </section>

      <h2 className="mt-6 text-sm font-semibold">Authorized apps</h2>
      {apps.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">You haven&apos;t authorized any apps.</p>
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
                  Authorized {timeAgo(app.connectedAt)}
                  {" · "}
                  {app.lastUsedAt ? `Last used ${timeAgo(app.lastUsedAt)}` : "Never used"}
                </p>
              </div>
              <RevokeButton id={app.id} name={app.name} />
            </li>
          ))}
        </ul>
      )}
      {apps.some((a) => !a.active) && (
        <p className="mt-2 text-xs text-muted">Access expires after 30 days without use. To use an expired app again, connect it again from the app.</p>
      )}

      <Link href="/" className="mt-6 inline-block text-sm text-muted hover:text-foreground">
        Back to the app
      </Link>
    </>
  );
}
