"use client";

import { startTransition, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toISODate } from "@/lib/dates";
import { LEAVE_TYPES, formatDays, formatLeaveSpan, partOnDay, spansOverlap, workingDays, type DayPart, type LeaveSpan, type LeaveType } from "@/lib/leave";
import { requestLeave } from "@/server/actions/leave";
import { cn } from "@/lib/utils";

// `sole`: the viewer is the only super admin, so there's nobody to ask and
// the leave is added as approved ("Add leave"). `booked`: their pending and
// approved leave, marked in the calendar so it can't be picked twice.
export function RequestLeaveDialog({
  open,
  onOpenChange,
  sole,
  booked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sole: boolean;
  booked: LeaveSpan[];
}) {
  const [type, setType] = useState<LeaveType>("holiday");
  const [range, setRange] = useState<DateRange | undefined>();
  const [onePart, setOnePart] = useState<DayPart>("full");
  const [startsAfternoon, setStartsAfternoon] = useState(false);
  const [endsMorning, setEndsMorning] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setType("holiday");
    setRange(undefined);
    setOnePart("full");
    setStartsAfternoon(false);
    setEndsMorning(false);
    setNote("");
    onOpenChange(false);
  }

  const startDate = range?.from ? toISODate(range.from) : null;
  const endDate = range?.to ? toISODate(range.to) : startDate;
  const oneDay = startDate === endDate;
  const span: LeaveSpan | null =
    startDate && endDate
      ? oneDay
        ? { startDate, endDate, startPart: onePart, endPart: onePart }
        : { startDate, endDate, startPart: startsAfternoon ? "afternoon" : "full", endPart: endsMorning ? "morning" : "full" }
      : null;
  const days = span ? workingDays(span) : 0;
  const clash = !!span && booked.some((b) => spansOverlap(span, b));
  const bookedOn = (date: Date) => {
    const iso = toISODate(date);
    return booked.map((b) => partOnDay(b, iso)).filter(Boolean);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!span) return;
    setPending(true);
    startTransition(async () => {
      try {
        const result = await requestLeave({ type, ...span, note });
        if ("error" in result) toast.error(result.error);
        else {
          toast.success(result.approved ? "Leave added to the calendar" : "Leave requested. A super admin will review it.");
          close();
        }
      } catch {
        toast.error("Couldn't send the request. Please try again.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {open && (
        <DialogContent
          title={sole ? "Add leave" : "Request leave"}
          description={
            sole
              ? "You're the only super admin, so there's nobody to ask: it's approved straight away and goes on the team calendar."
              : "A super admin reviews it. Once approved, it shows on the team calendar."
          }
          className="max-w-lg"
        >
          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Type</p>
              <div role="radiogroup" aria-label="Leave type" className="flex flex-wrap gap-2">
                {LEAVE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={type === t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      type === t.id ? "border-primary bg-selected/40 font-medium" : "border-grid hover:bg-hover/50",
                    )}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Only you and super admins see the type and note.</p>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Dates</p>
              <p className="mb-2 text-xs text-muted">Click the first day, then the last. Click one day twice for a single day.</p>
              <div className="flex justify-center rounded-xl border border-grid p-2">
                <DayPicker
                  mode="range"
                  weekStartsOn={1}
                  selected={range}
                  onSelect={setRange}
                  // Fully booked days can't be picked; half-booked ones are outlined.
                  disabled={(date) => bookedOn(date).includes("full")}
                  modifiers={{ halfBooked: (date) => bookedOn(date).some((p) => p !== "full") }}
                  modifiersClassNames={{ halfBooked: "[&>button]:outline-1 [&>button]:outline-dashed [&>button]:-outline-offset-2 [&>button]:outline-primary" }}
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
                    range_middle: "bg-selected [&>button]:!bg-transparent [&>button]:!text-foreground",
                    range_start: "rounded-l-full bg-selected",
                    range_end: "rounded-r-full bg-selected",
                    outside: "text-muted/50",
                    disabled: "[&>button]:cursor-not-allowed [&>button]:text-muted/40 [&>button]:line-through [&>button]:hover:bg-transparent",
                  }}
                />
              </div>
              {booked.length > 0 && (
                <p className="mt-1.5 text-xs text-muted">
                  <span className="line-through">Crossed-out</span> days are already booked; outlined days have half a day booked.
                </p>
              )}
            </div>

            {span && (
              <div className="space-y-2 rounded-xl bg-background/60 p-3">
                {oneDay ? (
                  <Segmented
                    label="How long"
                    value={onePart}
                    onChange={setOnePart}
                    options={[
                      { value: "full", label: "Full day" },
                      { value: "morning", label: "Morning" },
                      { value: "afternoon", label: "Afternoon" },
                    ]}
                  />
                ) : (
                  <>
                    <Segmented
                      label="First day"
                      value={startsAfternoon ? "afternoon" : "full"}
                      onChange={(v) => setStartsAfternoon(v === "afternoon")}
                      options={[
                        { value: "full", label: "Full day" },
                        { value: "afternoon", label: "Afternoon only" },
                      ]}
                    />
                    <Segmented
                      label="Last day"
                      value={endsMorning ? "morning" : "full"}
                      onChange={(v) => setEndsMorning(v === "morning")}
                      options={[
                        { value: "full", label: "Full day" },
                        { value: "morning", label: "Morning only" },
                      ]}
                    />
                  </>
                )}
                <p className="pt-1 text-sm">
                  <span className="font-medium">{formatLeaveSpan(span)}</span>
                  <span className={cn("ml-2", days === 0 ? "text-danger" : "text-muted")}>
                    {days === 0 ? "Only weekend days" : formatDays(days)}
                  </span>
                </p>
                {clash && (
                  <p role="alert" className="text-sm text-danger">
                    You already have leave on some of these days. Pick other dates, or cancel the earlier leave first.
                  </p>
                )}
              </div>
            )}

            <label className="block text-sm font-medium">
              Note <span className="font-normal text-muted">(optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Anything the approver should know"
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!span || days === 0 || clash || pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {sole ? "Add leave" : "Send request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-sm text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-grid bg-surface p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              value === o.value ? "bg-primary font-medium text-white" : "text-muted hover:bg-hover hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
