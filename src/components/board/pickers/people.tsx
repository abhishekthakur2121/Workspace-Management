"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Person } from "../model";

// Searchable people picker: single (accountable) or multiple (responsible).
const displayName = (p: Person) => p.name ?? p.email;

export function PeoplePicker({
  people,
  value,
  multiple,
  onChange,
  children,
}: {
  people: Person[];
  value: string[];
  multiple: boolean;
  onChange: (ids: string[]) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value.map((id) => people.find((p) => p.id === id)).filter((p) => p !== undefined);
  const q = query.trim().toLowerCase();
  const options = people.filter(
    (p) => p.active && !value.includes(p.id) && (!q || displayName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      {children}
      <PopoverContent className="w-72 p-2">
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-hover py-0.5 pr-1 pl-0.5 text-xs">
                <Avatar name={displayName(p)} image={p.image} className="size-5 text-[9px]" />
                <span className={cn(!p.active && "text-muted line-through")}>{displayName(p)}</span>
                <button
                  aria-label={`Remove ${displayName(p)}`}
                  onClick={() => onChange(value.filter((id) => id !== p.id))}
                  className="rounded-full p-0.5 hover:bg-border"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md border border-border px-2 focus-within:border-primary">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names or emails"
            className="h-8 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="mt-1 max-h-60 overflow-y-auto">
          {options.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (multiple) {
                  onChange([...value, p.id]);
                  setQuery("");
                } else {
                  onChange([p.id]);
                  setOpen(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
            >
              <Avatar name={displayName(p)} image={p.image} className="size-6 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{displayName(p)}</span>
                {p.name && <span className="block truncate text-xs text-muted">{p.email}</span>}
              </span>
            </button>
          ))}
          {options.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted">No one else to add</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
