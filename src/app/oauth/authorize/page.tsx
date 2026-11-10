import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Check, ShieldCheck, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { requireUser } from "@/server/auth-guard";
import { originOf } from "@/server/oauth/config";
import { parseAuthorizeRequest } from "@/server/oauth/authorize";
import { approveConnection, declineConnection } from "@/server/actions/oauth";

export const metadata: Metadata = { title: "Connect an app" };

// Where an app sends someone to approve access (the OAuth authorization
// endpoint). Signed-out visitors are sent to sign in first and come back here.
export default function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-md rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <div className="mb-7">
          <BrandLogo size="lg" />
        </div>
        <Suspense fallback={<div className="skeleton h-72 rounded-xl" aria-busy="true" />}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Consent({ searchParams }: Pick<PageProps<"/oauth/authorize">, "searchParams">) {
  await connection();
  const user = await requireUser();
  const params = Object.fromEntries(
    Object.entries(await searchParams).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  );
  const parsed = await parseAuthorizeRequest(params, originOf(await headers()));
  if (!parsed.ok) {
    if ("redirect" in parsed) redirect(parsed.redirect);
    return (
      <>
        <h1 className="text-xl font-semibold">Can&apos;t connect this app</h1>
        <p className="mt-2 text-sm text-muted">{parsed.message}</p>
      </>
    );
  }

  const { client, redirectUri } = parsed.request;
  const returnHost = new URL(redirectUri).host;
  const name = user.name ?? user.email ?? "";
  return (
    <>
      <h1 className="text-xl font-semibold">Connect {client.name}?</h1>
      <p className="mt-1 text-sm text-muted">
        <span className="font-medium text-foreground">{client.name}</span> wants to use Nxt Workspace Manager as you.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-xl bg-background/60 p-3">
        <Avatar name={name} image={user.image} className="size-9 text-xs" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-muted">{user.email}</p>
        </div>
      </div>

      <p className="mt-5 text-sm font-medium">It will be able to</p>
      <ul className="mt-2 space-y-2 text-sm">
        <Permission ok>See the boards and tasks you can see</Permission>
        <Permission ok>Create and update tasks, and add comments, in your name</Permission>
        <Permission>It can&apos;t delete anything, or see your password</Permission>
      </ul>

      <p className="mt-5 flex gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 shrink-0" />
        <span>
          After you allow it, you&apos;ll go back to <span className="font-medium text-foreground">{returnHost}</span>. Only connect apps you
          trust. You can disconnect it at any time.
        </span>
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <form action={declineConnection.bind(null, params)}>
          <Button type="submit" variant="secondary">
            Cancel
          </Button>
        </form>
        <form action={approveConnection.bind(null, params)}>
          <Button type="submit">Allow</Button>
        </form>
      </div>
    </>
  );
}

function Permission({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" />}
      <span className={ok ? undefined : "text-muted"}>{children}</span>
    </li>
  );
}
