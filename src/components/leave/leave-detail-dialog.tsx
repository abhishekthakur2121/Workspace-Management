"use client";

import { startTransition, useEffect, useState } from "react";
import { Ban, Check, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LabelPill } from "@/components/ui/label-pill";
import { LEAVE_STATUSES, formatDays, formatLeaveSpan, leaveTypeMeta, workingDays } from "@/lib/leave";
import { cancelLeave, decideLeave, loadLeaveDetail, revokeLeave, type LeaveDetail } from "@/server/actions/leave";

const ACTIONS: Record<LeaveDetail["history"][number]["action"], string> = {
  requested: "Requested by",
  approved: "Approved by",
  auto_approved: "Added and approved at once (the only super admin) by",
  rejected: "Rejected by",
  cancelled: "Cancelled by",
  revoked: "Revoked by",
};

type Mode = "idle" | "revoke" | "cancel";

// One request: who, when, and (for the person and super admins) the type,
// note and full history, plus whatever the viewer may do with it.
export function LeaveDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<LeaveDetail | null | undefined>();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (id !== loadedId) {
    setLoadedId(id);
    setDetail(undefined);
    setMode("idle");
    setNote("");
  }

  useEffect(() => {
    if (!id) return;
    let alive = true;
    startTransition(async () => {
      try {
        const d = await loadLeaveDetail({ id });
        if (alive) setDetail(d);
      } catch {
        if (alive) setDetail(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  function run(action: () => Promise<{ ok: true } | { error: string }>, done: string) {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await action();
        if ("error" in result) toast.error(result.error);
        else {
          toast.success(done);
          onClose();
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  const name = detail ? (detail.user.name ?? detail.user.email) : "";
  const status = detail ? LEAVE_STATUSES[detail.status] : null;
  const type = detail?.type ? leaveTypeMeta(detail.type) : null;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DialogContent title="Leave" className="max-w-lg">
          {detail === undefined ? (
            <div className="space-y-3" aria-busy="true">
              <div className="skeleton h-10 rounded-lg" />
              <div className="skeleton h-24 rounded-lg" />
            </div>
          ) : detail === null ? (
            <p className="text-sm text-muted">This leave request isn&apos;t available any more.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={name} image={detail.user.image} className="size-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-sm text-muted">
                    {formatLeaveSpan(detail)} · {formatDays(workingDays(detail))}
                  </p>
                </div>
                {status && (
                  <span className="h-6 w-24 shrink-0">
                    <LabelPill color={status.color}>{status.label}</LabelPill>
                  </span>
                )}
              </div>

              {type && (
                <div className="rounded-xl bg-background/60 p-3 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                    <span className="font-medium">{type.label}</span>
                  </p>
                  {detail.note && <p className="mt-1.5 whitespace-pre-wrap text-muted">{detail.note}</p>}
                </div>
              )}

              {detail.history.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">History</p>
                  <ol className="space-y-2 border-l-2 border-grid pl-3">
                    {detail.history.map((e) => (
                      <li key={e.id} className="text-sm">
                        <span>
                          {ACTIONS[e.action]} <span className="font-medium">{e.actorName}</span>
                        </span>
                        <span className="ml-2 text-xs text-muted">
                          {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        {e.note && <p className="mt-0.5 text-muted">&ldquo;{e.note}&rdquo;</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {detail.can.decide && (
                <div className="space-y-2 border-t border-grid pt-4">
                  <ReasonField value={note} onChange={setNote} placeholder="Reason (optional), shown in the history" />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => decideLeave({ id: detail.id, approve: false, note }), "Leave rejected")}>
                      <X className="size-4" /> Reject
                    </Button>
                    <Button disabled={busy} onClick={() => run(() => decideLeave({ id: detail.id, approve: true, note }), "Leave approved")}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
                    </Button>
                  </div>
                </div>
              )}

              {(detail.can.revoke || detail.can.cancel) && (
                <div className="space-y-2 border-t border-grid pt-4">
                  {mode === "revoke" ? (
                    <>
                      <ReasonField value={note} onChange={setNote} placeholder="Why is this leave revoked? (required)" autoFocus />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setMode("idle")}>
                          Back
                        </Button>
                        <Button variant="danger" disabled={busy || !note.trim()} onClick={() => run(() => revokeLeave({ id: detail.id, note }), "Leave revoked")}>
                          {busy && <Loader2 className="size-4 animate-spin" />} Revoke leave
                        </Button>
                      </div>
                    </>
                  ) : mode === "cancel" ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="mr-auto text-sm">Cancel this request?</span>
                      <Button variant="secondary" onClick={() => setMode("idle")}>
                        Keep it
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => run(() => cancelLeave({ id: detail.id }), "Request cancelled")}>
                        {busy && <Loader2 className="size-4 animate-spin" />} Cancel request
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      {detail.can.cancel && (
                        <Button variant="secondary" onClick={() => setMode("cancel")}>
                          <Undo2 className="size-4" /> Cancel request
                        </Button>
                      )}
                      {detail.can.revoke && (
                        <Button variant="secondary" className="text-danger" onClick={() => setMode("revoke")}>
                          <Ban className="size-4" /> Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReasonField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={500}
      rows={2}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    />
  );
}
