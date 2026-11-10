"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { todayISO } from "@/lib/dates";
import { LEAVE_TYPES, addDays, formatLeaveSpan, leaveTypeMeta, partOnDay, type DayPart } from "@/lib/leave";
import type { LeaveEntry, LeaveOverview } from "@/server/queries/leave";
import { cn } from "@/lib/utils";

// Leave without a visible type (someone else's, for non-super admins).
const AWAY_COLOR = "#579bfc";
const noopSubscribe = () => () => {};

function shiftMonth(month: string, by: number) {
  const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

// The team wallchart, as leave tools show it: one row per person, one column
// per day of the month. Approved leave only; half days fill half a cell.
export function TeamWallchart({
  month,
  range,
  people,
  entries,
  meId,
  onOpen,
}: {
  month: string;
  range: LeaveOverview["range"];
  people: LeaveOverview["people"];
  entries: LeaveEntry[];
  meId: string;
  onOpen: (id: string) => void;
}) {
  // The viewer's own today, known only in the browser.
  const today = useSyncExternalStore(noopSubscribe, todayISO, () => null);
  const days: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  // You first, then everyone else alphabetically.
  const rows = [...people].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));
  const byPerson = new Map<string, LeaveEntry[]>();
  for (const e of entries) byPerson.set(e.user.id, [...(byPerson.get(e.user.id) ?? []), e]);
  const outToday = today ? entries.filter((e) => partOnDay(e, today)).length : 0;
  const awayThisMonth = byPerson.size;
  const showsTypes = entries.some((e) => e.type);
  const showsUntyped = entries.some((e) => !e.type);

  const columns = `minmax(9rem, 13rem) repeat(${days.length}, minmax(1.6rem, 1fr))`;
  const navButton = "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-foreground";

  return (
    <section aria-label="Team leave chart" className="card-shadow overflow-clip rounded-xl border border-grid bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-grid px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-grid p-0.5">
          <Link href={`/leave?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className={navButton} scroll={false}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/leave" className="rounded-md px-2 py-0.5 text-sm font-medium transition-colors hover:bg-hover" scroll={false}>
            Today
          </Link>
          <Link href={`/leave?month=${shiftMonth(month, 1)}`} aria-label="Next month" className={navButton} scroll={false}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <div className="ml-auto flex gap-2 text-xs">
          {today?.startsWith(month) && (
            <span className="rounded-full bg-hover px-2.5 py-1 text-muted">
              <span className="font-semibold text-foreground">{outToday}</span> out today
            </span>
          )}
          <span className="rounded-full bg-hover px-2.5 py-1 text-muted">
            <span className="font-semibold text-foreground">{awayThisMonth}</span> away this month
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div role="table" aria-label={`Leave in ${title}`} className="grid min-w-max text-xs sm:min-w-0" style={{ gridTemplateColumns: columns }}>
          {/* Header: weekday initial and date. */}
          <div role="columnheader" className="sticky left-0 z-10 flex items-end border-b border-grid bg-surface px-4 pb-1.5 font-medium text-muted">
            Person
          </div>
          {days.map((iso) => {
            const weekend = [0, 6].includes(weekdayOf(iso));
            const isToday = iso === today;
            return (
              <div
                key={iso}
                role="columnheader"
                className={cn("flex flex-col items-center gap-0.5 border-b border-grid py-1.5", weekend && "bg-background/60", isToday && "bg-primary/10")}
              >
                <span className={cn("text-[10px]", weekend ? "text-muted/50" : "text-muted")}>
                  {new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" })}
                </span>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-[11px] tabular-nums",
                    isToday ? "bg-primary font-semibold text-white" : weekend ? "text-muted/60" : "font-medium",
                  )}
                >
                  {+iso.slice(8)}
                </span>
              </div>
            );
          })}

          {rows.map((p) => {
            const mine = byPerson.get(p.id) ?? [];
            const name = p.name ?? p.email;
            let daysOff = 0;
            for (const iso of days) for (const e of mine) {
              const part = partOnDay(e, iso);
              if (part) daysOff += part === "full" ? 1 : 0.5;
            }
            return (
              <div key={p.id} role="row" className="group/row contents">
                <div role="rowheader" className="sticky left-0 z-10 flex h-9 items-center gap-2 border-b border-grid bg-surface px-4 group-last/row:border-b-0 group-hover/row:bg-hover">
                  <Avatar name={name} image={p.image} className="size-6 shrink-0 text-[9px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {name}
                    {p.id === meId && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  {daysOff > 0 && <span className="shrink-0 text-[11px] text-muted tabular-nums">{daysOff}d</span>}
                </div>
                {days.map((iso) => (
                  <DayCell key={iso} iso={iso} entries={mine} today={today} onOpen={onOpen} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-grid px-4 py-2 text-xs text-muted">
        {showsTypes &&
          LEAVE_TYPES.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: t.color }} /> {t.label}
            </span>
          ))}
        {(showsUntyped || !showsTypes) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: AWAY_COLOR }} /> Away
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="relative h-2.5 w-4 overflow-hidden rounded-sm bg-hover">
            <span className="absolute inset-y-0 left-0 w-1/2" style={{ backgroundColor: AWAY_COLOR }} />
          </span>
          Half day
        </span>
        <span className="ml-auto hidden sm:inline">Click a block for details</span>
      </div>
    </section>
  );
}

function DayCell({ iso, entries, today, onOpen }: { iso: string; entries: LeaveEntry[]; today: string | null; onOpen: (id: string) => void }) {
  const weekend = [0, 6].includes(weekdayOf(iso));
  const hit = entries.map((e) => ({ e, part: partOnDay(e, iso) })).find((x) => x.part);
  return (
    <div
      role="cell"
      className={cn(
        "relative h-9 border-b border-grid group-last/row:border-b-0 group-hover/row:bg-hover/60",
        weekend && "bg-background/60",
        iso === today && "bg-primary/[0.07]",
      )}
    >
      {hit && <Block entry={hit.e} part={hit.part!} iso={iso} onOpen={onOpen} />}
    </div>
  );
}

// A day of leave. Consecutive days join into one band (rounded only where the
// leave starts or ends, or a weekend interrupts it); half days fill half.
function Block({ entry, part, iso, onOpen }: { entry: LeaveEntry; part: DayPart; iso: string; onOpen: (id: string) => void }) {
  const color = entry.type ? leaveTypeMeta(entry.type).color : AWAY_COLOR;
  const joinsLeft = part !== "afternoon" && partOnDay(entry, addDays(iso, -1)) !== null && partOnDay(entry, addDays(iso, -1)) !== "morning";
  const joinsRight = part !== "morning" && partOnDay(entry, addDays(iso, 1)) !== null && partOnDay(entry, addDays(iso, 1)) !== "afternoon";
  const name = entry.user.name ?? entry.user.email;
  const label = `${name}: away ${formatLeaveSpan(entry)}${entry.type ? ` (${leaveTypeMeta(entry.type).label})` : ""}`;
  return (
    <button
      onClick={() => onOpen(entry.id)}
      title={label}
      aria-label={label}
      className={cn(
        "absolute inset-y-1.5 transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        part === "afternoon" ? "left-1/2" : joinsLeft ? "-left-px" : "left-0.5",
        part === "morning" ? "right-1/2" : joinsRight ? "-right-px" : "right-0.5",
        !joinsLeft && "rounded-l-md",
        !joinsRight && "rounded-r-md",
      )}
      style={{ backgroundColor: color }}
    />
  );
}
