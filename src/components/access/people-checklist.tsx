"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SearchField } from "@/components/ui/search-field";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string | null; email: string; image: string | null };

// Searchable list of people with checkboxes. `locked` people are shown ticked
// and can't be changed (e.g. workspace admins always see every board).
export function PeopleChecklist({
  people,
  selected,
  onToggle,
  locked = {},
  emptyText = "No one to show",
}: {
  people: PersonOption[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  locked?: Record<string, string>; // id → reason
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => !q || p.email.toLowerCase().includes(q) || (p.name ?? "").toLowerCase().includes(q));
  return (
    <div className="rounded-xl border border-grid">
      <div className="border-b border-grid p-2">
        <SearchField value={query} onChange={setQuery} placeholder="Search people" label="Search people" className="w-full" inputClassName="w-full" />
      </div>
      <ul className="max-h-64 overflow-y-auto p-1">
        {shown.map((p) => {
          const reason = locked[p.id];
          const on = !!reason || selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!!reason}
                onClick={() => onToggle(p.id, !on)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                    on ? "border-primary bg-primary text-white" : "border-border",
                    reason && "opacity-60",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                <Avatar name={p.name ?? p.email} image={p.image} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name ?? p.email}</span>
                  {p.name && <span className="block truncate text-xs text-muted">{p.email}</span>}
                </span>
                {reason && <span className="shrink-0 text-xs text-muted">{reason}</span>}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{q ? "No one matches" : emptyText}</li>}
      </ul>
    </div>
  );
}
