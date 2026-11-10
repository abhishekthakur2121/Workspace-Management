"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SearchField } from "@/components/ui/search-field";
import { addDaysISO, todayISO } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/roles";
import type { WorkloadPerson } from "@/server/queries/workload";
import { cn } from "@/lib/utils";

// Counted here so "today" is the viewer's today, as on My work.
function counts(dueDates: (string | null)[]) {
  const today = todayISO();
  const week = addDaysISO(today, 7);
  return {
    open: dueDates.length,
    overdue: dueDates.filter((d) => d && d < today).length,
    soon: dueDates.filter((d) => d && d >= today && d <= week).length,
  };
}

const GRID = "md:grid-cols-[minmax(240px,1fr)_110px_110px_120px_40px]";

export function TeamOverview({ people }: { people: WorkloadPerson[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));

  return (
    <div className="space-y-4 p-6">
      <SearchField value={query} onChange={setQuery} placeholder="Search people" label="Search people" inputClassName="w-44" />

      {shown.length === 0 ? (
        <div className="card-shadow grid place-items-center rounded-xl border border-grid bg-surface px-6 py-14 text-center">
          <UsersRound className="size-8 text-primary" />
          <p className="mt-3 font-medium">No one matches your search</p>
          <p className="mt-1 text-sm text-muted">Try another name or email.</p>
        </div>
      ) : (
        <div className="card-shadow overflow-clip rounded-xl border border-grid bg-surface">
          <div className={cn("hidden h-9 border-b border-grid text-xs font-medium text-muted md:grid", GRID)}>
            <div className="flex items-center px-4">Person</div>
            <div className="grid place-items-center">Open</div>
            <div className="grid place-items-center">Overdue</div>
            <div className="grid place-items-center">Next 7 days</div>
            <div />
          </div>
          <ul>
            {shown.map((p) => {
              const c = counts(p.openDueDates);
              const name = p.name ?? p.email;
              return (
                <li key={p.id} className="border-b border-grid last:border-b-0">
                  <Link
                    href={`/team/${p.id}`}
                    className={cn(
                      "grid grid-cols-[1fr_auto] items-center gap-y-1 py-2.5 transition-colors hover:bg-background/60 md:grid",
                      GRID,
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3 px-4">
                      <Avatar name={name} image={p.image} className="size-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.name ? `${p.email} · ` : ""}
                          {ROLE_LABELS[p.role]}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="mr-4 size-4 text-muted md:hidden" />
                    <span className="col-span-2 flex gap-4 px-4 text-xs text-muted md:contents md:text-sm">
                      <Count value={c.open} label="open" />
                      <Count value={c.overdue} label="overdue" tone={c.overdue > 0 ? "danger" : undefined} />
                      <Count value={c.soon} label="next 7 days" />
                    </span>
                    <ChevronRight className="hidden size-4 text-muted md:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// On small screens the label follows the number; on wide screens the column
// header names it.
function Count({ value, label, tone }: { value: number; label: string; tone?: "danger" }) {
  return (
    <span className={cn("md:grid md:place-items-center", tone === "danger" && "font-semibold text-danger", value === 0 && "md:text-muted/60")}>
      <span>
        {value}
        <span className="md:hidden"> {label}</span>
      </span>
    </span>
  );
}
