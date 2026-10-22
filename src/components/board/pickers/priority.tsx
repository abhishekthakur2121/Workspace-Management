"use client";

import { useState } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRIORITIES, type Priority } from "../model";

export function PriorityPicker({
  value,
  onChange,
  children,
}: {
  value: Priority | null;
  onChange: (p: Priority | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {children}
      <PopoverContent className="w-52 space-y-1.5 p-2">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              onChange(p.value);
              setOpen(false);
            }}
            className={cn(
              "neon-pill neon-interactive h-8 w-full text-[13px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.98]",
              value === p.value && "ring-2 ring-offset-2 ring-offset-surface",
            )}
            style={{ "--c": p.color, "--tw-ring-color": p.color } as React.CSSProperties}
          >
            {p.label}
          </button>
        ))}
        {value && (
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex h-8 w-full items-center justify-center rounded-full border-[1.5px] border-dashed border-border text-sm text-muted transition hover:bg-hover"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
