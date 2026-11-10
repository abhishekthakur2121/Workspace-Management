"use client";

import { startTransition, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, CalendarDays, CalendarPlus, Check, Copy, History, Loader2, Plane, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LabelPill } from "@/components/ui/label-pill";
import { LEAVE_STATUSES, formatDays, formatLeaveSpan, leaveTypeMeta, workingDays, type LeaveSpan, type LeaveStatus, type LeaveType } from "@/lib/leave";
import { resetCalendarLink } from "@/server/actions/leave";
import type { DecidedLeave, LeaveEntry, LeaveOverview } from "@/server/queries/leave";
import { cn } from "@/lib/utils";
import { TeamWallchart } from "./team-wallchart";
import { LeaveDetailDialog } from "./leave-detail-dialog";
import { RequestLeaveDialog } from "./request-leave-dialog";

const noopSubscribe = () => () => {};

export function RequestLeaveButton({ sole, booked }: { sole: boolean; booked: LeaveSpan[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" /> {sole ? "Add leave" : "Request leave"}
      </Button>
      <RequestLeaveDialog open={open} onOpenChange={setOpen} sole={sole} booked={booked} />
    </>
  );
}

type Tab = "calendar" | "mine" | "approvals";

export function LeaveView({
  overview,
  month,
  feedToken,
  isSuperAdmin,
  meId,
}: {
  overview: LeaveOverview;
  month: string;
  feedToken: string;
  isSuperAdmin: boolean;
  meId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // The tab lives in the URL (?tab=…) and switches without a server round trip.
  const requested = useSearchParams().get("tab");
  const tab: Tab = requested === "mine" || (requested === "approvals" && isSuperAdmin) ? requested : "calendar";
  const waiting = overview.pending.filter((r) => !r.isMine).length;
  const myPending = overview.mine.filter((r) => r.status === "pending").length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "calendar", label: "Team calendar", icon: <CalendarDays /> },
    { id: "mine", label: "My leave", icon: <CalendarCheck2 />, count: myPending },
    ...(isSuperAdmin ? [{ id: "approvals" as const, label: "Approvals", icon: <ShieldCheck />, count: waiting }] : []),
  ];

  return (
    <>
      <nav className="flex gap-5 border-b border-grid bg-surface px-6" aria-label="Leave sections">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={t.id === "calendar" ? "?" : `?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={(e) => {
              // Plain clicks switch in place; modifier clicks open a new tab as usual.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              const next = new URLSearchParams(window.location.search);
              if (t.id === "calendar") next.delete("tab");
              else next.set("tab", t.id);
              const query = next.toString();
              window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
            }}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors [&>svg]:size-4",
              tab === t.id ? "border-primary text-foreground [&>svg]:text-primary" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
            {!!t.count && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white" aria-label={`${t.count} pending`}>
                {t.count}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="space-y-6 p-6">
        {tab === "calendar" && (
          <>
            <TeamWallchart month={month} range={overview.range} people={overview.people} entries={overview.calendar} meId={meId} onOpen={setOpenId} />
            <Section title="Away in the next 30 days" count={overview.soon.length}>
              {overview.soon.length === 0 ? (
                <Empty icon={<Plane className="size-6 text-primary" />} text="Nobody has approved leave coming up." />
              ) : (
                <List>
                  {overview.soon.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background/60">
                        <Person entry={r} />
                        <TypeTag type={r.type} />
                      </button>
                    </li>
                  ))}
                </List>
              )}
            </Section>
            <CalendarLink token={feedToken} canReset={isSuperAdmin} />
          </>
        )}

        {tab === "mine" && (
          <Section title="My requests" count={overview.mine.length}>
            {overview.mine.length === 0 ? (
              <Empty icon={<CalendarCheck2 className="size-6 text-primary" />} text="Your leave requests will show up here." />
            ) : (
              <List>
                {overview.mine.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background/60">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: leaveTypeMeta(r.type).color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{formatLeaveSpan(r)}</span>
                        <span className="block text-xs text-muted">
                          {leaveTypeMeta(r.type).label} · {formatDays(workingDays(r))}
                        </span>
                      </span>
                      <StatusPill status={r.status} />
                    </button>
                  </li>
                ))}
              </List>
            )}
          </Section>
        )}

        {tab === "approvals" && (
          <>
            <Section title="Waiting for approval" count={overview.pending.length}>
              {overview.pending.length === 0 ? (
                <Empty icon={<Check className="size-6 text-[#00c875]" />} text="Nothing waiting. New requests show up here." />
              ) : (
                <List>
                  {overview.pending.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Person entry={r} />
                      <TypeTag type={r.type} />
                      {r.isMine ? (
                        <span className="text-xs text-muted">Your own request: another super admin decides</span>
                      ) : (
                        <Button size="sm" onClick={() => setOpenId(r.id)}>
                          Review
                        </Button>
                      )}
                    </li>
                  ))}
                </List>
              )}
            </Section>
            <Section title="Recently decided" count={overview.decided.length}>
              {overview.decided.length === 0 ? (
                <Empty icon={<History className="size-6 text-primary" />} text="Decisions from the last 30 days show up here." />
              ) : (
                <List>
                  {overview.decided.map((d) => (
                    <li key={d.id}>
                      <button onClick={() => setOpenId(d.request.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-background/60">
                        <Person entry={d.request} />
                        <span className="min-w-0 text-right text-xs text-muted">
                          <span className="block">
                            {DECISIONS[d.action]} by <span className="font-medium text-foreground">{d.by}</span>
                          </span>
                          <span className="block">{new Date(d.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                        </span>
                        <StatusPill status={d.status} />
                      </button>
                    </li>
                  ))}
                </List>
              )}
            </Section>
          </>
        )}
      </div>

      <LeaveDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

const DECISIONS: Record<DecidedLeave["action"], string> = {
  requested: "Requested",
  approved: "Approved",
  auto_approved: "Added",
  rejected: "Rejected",
  cancelled: "Cancelled",
  revoked: "Revoked",
};

function List({ children }: { children: React.ReactNode }) {
  return <ul className="card-shadow divide-y divide-grid overflow-clip rounded-xl border border-grid bg-surface">{children}</ul>;
}

function StatusPill({ status }: { status: LeaveStatus }) {
  const meta = LEAVE_STATUSES[status];
  return (
    <span className="h-6 w-24 shrink-0">
      <LabelPill color={meta.color}>{meta.label}</LabelPill>
    </span>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-muted">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Person({ entry }: { entry: Pick<LeaveEntry, "user" | "startDate" | "endDate" | "startPart" | "endPart"> }) {
  const name = entry.user.name ?? entry.user.email;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={name} image={entry.user.image} className="size-8" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">
          {formatLeaveSpan(entry)} · {formatDays(workingDays(entry))}
        </span>
      </span>
    </span>
  );
}

// Shown only when the viewer may see the type (their own, or super admins).
function TypeTag({ type }: { type: LeaveType | null }) {
  if (!type) return null;
  const meta = leaveTypeMeta(type);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="card-shadow grid place-items-center rounded-xl border border-grid bg-surface px-6 py-10 text-center">
      {icon}
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

// The subscription link for Outlook and other calendar apps.
function CalendarLink({ token, canReset }: { token: string; canReset: boolean }) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const url = `${origin}/api/calendar/${token}.ics`;
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  function reset() {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await resetCalendarLink();
        if ("error" in result) toast.error(result.error);
        else toast.success("New link created. The old one no longer works.");
      } catch {
        toast.error("Couldn't reset the link.");
      } finally {
        setBusy(false);
        setConfirming(false);
      }
    });
  }

  return (
    <section aria-label="Calendar link" className="card-shadow rounded-xl border border-grid bg-surface p-4">
      <h2 className="font-semibold">See leave in Outlook</h2>
      <p className="mt-1 text-sm text-muted">
        In Outlook choose <span className="font-medium text-foreground">Add calendar → Subscribe from web</span> (or
        &ldquo;From internet&rdquo;) and paste this link. It lists who is away and when, never the type or note. Outlook
        refreshes it every few hours. Keep it within the team.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Calendar link"
          onFocus={(e) => e.target.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 font-mono text-xs outline-none"
        />
        <Button variant="secondary" onClick={copy} disabled={!origin}>
          {copied ? <Check className="size-4 text-[#00c875]" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </Button>
        {canReset &&
          (confirming ? (
            <>
              <Button variant="danger" onClick={reset} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} Reset link
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)} title="Make a new link; anyone using the old one stops seeing leave">
              <RefreshCw className="size-4" /> Reset
            </Button>
          ))}
      </div>
      {confirming && <p className="mt-2 text-xs text-danger">Everyone subscribed with the current link will need the new one.</p>}
    </section>
  );
}
