"use client";

import { startTransition, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { createTag } from "@/server/actions/board-structure";
import { cn } from "@/lib/utils";
import type { Tag } from "../model";

// Toggle tags on a task; typing a new name and pressing Enter creates it.
export function TagsPicker({
  boardId,
  tags,
  value,
  onChange,
  onTagCreated,
  children,
}: {
  boardId: string;
  tags: Tag[];
  value: string[];
  onChange: (ids: string[]) => void;
  onTagCreated?: (tag: Tag) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === q.toLowerCase());

  function create() {
    if (!q) return;
    setQuery("");
    // Server actions resolve reliably inside a transition.
    startTransition(async () => {
      const tag = await createTag({ boardId, name: q });
      onTagCreated?.(tag);
      if (!value.includes(tag.id)) onChange([...value, tag.id]);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      {children}
      <PopoverContent className="w-64 p-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const match = filtered[0];
              if (match && match.name.toLowerCase() === q.toLowerCase()) {
                onChange(value.includes(match.id) ? value : [...value, match.id]);
                setQuery("");
              } else create();
            }
          }}
          placeholder="Search or create a tag"
          maxLength={60}
          className="h-8 w-full rounded-md border border-border px-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-1 max-h-60 overflow-y-auto">
          {filtered.map((t) => {
            const on = value.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onChange(on ? value.filter((id) => id !== t.id) : [...value, t.id])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
              >
                <span className={cn("grid size-4 place-items-center rounded border", on ? "border-primary bg-primary text-white" : "border-border")}>
                  {on && <Check className="size-3" />}
                </span>
                <TagChip tag={t} />
              </button>
            );
          })}
          {q && !exact && (
            <button onClick={create} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-primary hover:bg-hover">
              <Plus className="size-4" /> Create &quot;{q}&quot;
            </button>
          )}
          {!q && tags.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted">Type to create the first tag</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
    >
      #{tag.name}
    </span>
  );
}
