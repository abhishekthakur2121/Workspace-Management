"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact search input with a clear button.
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-text items-center gap-1.5 rounded-md border border-grid bg-background/60 px-2.5 text-[13px] transition-colors hover:border-border focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/15",
        value && "border-primary bg-surface",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn("w-28 bg-transparent outline-none placeholder:text-muted", inputClassName)}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="rounded p-0.5 text-muted hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}
