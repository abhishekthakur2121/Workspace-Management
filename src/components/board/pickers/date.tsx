"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { addDaysISO, isoToLocalDate, toISODate, todayISO } from "@/lib/dates";

// Calendar with quick picks (Today, Tomorrow, Next week) and Clear.
export function DatePicker({
  value,
  onChange,
  children,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const pick = (iso: string | null) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {children}
      <PopoverContent className="w-auto p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[
            ["Today", today],
            ["Tomorrow", addDaysISO(today, 1)],
            ["Next week", addDaysISO(today, 7)],
          ].map(([label, iso]) => (
            <button key={label} onClick={() => pick(iso)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-hover">
              {label}
            </button>
          ))}
          {value && (
            <button onClick={() => pick(null)} className="rounded-full border border-border px-2.5 py-1 text-xs text-danger hover:bg-hover">
              Clear
            </button>
          )}
        </div>
        <DayPicker
          mode="single"
          weekStartsOn={1}
          selected={value ? isoToLocalDate(value) : undefined}
          defaultMonth={value ? isoToLocalDate(value) : undefined}
          onSelect={(d) => d && pick(toISODate(d))}
          classNames={{
            root: "text-sm",
            months: "relative",
            month_caption: "flex h-8 items-center justify-center font-semibold",
            nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
            button_previous: "grid size-7 place-items-center rounded hover:bg-hover [&_svg]:size-4 [&_svg]:fill-muted",
            button_next: "grid size-7 place-items-center rounded hover:bg-hover [&_svg]:size-4 [&_svg]:fill-muted",
            weekday: "size-9 text-xs font-normal text-muted",
            day: "size-9 p-0 text-center",
            day_button: "size-9 rounded-full hover:bg-hover",
            today: "font-bold text-primary",
            selected: "[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary-hover",
            outside: "text-muted/50",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
