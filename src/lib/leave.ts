// Leave rules shared by the server and the browser. Dates are plain calendar
// days ("YYYY-MM-DD"), like due dates.

export type LeaveType = "holiday" | "sick" | "personal" | "other";
export type DayPart = "full" | "morning" | "afternoon";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled" | "revoked";

export const LEAVE_TYPES: { id: LeaveType; label: string; color: string }[] = [
  { id: "holiday", label: "Holiday", color: "#00c875" },
  { id: "sick", label: "Sick", color: "#e2445c" },
  { id: "personal", label: "Personal", color: "#a25ddc" },
  { id: "other", label: "Other", color: "#579bfc" },
];
export const leaveTypeMeta = (t: LeaveType) => LEAVE_TYPES.find((x) => x.id === t)!;

export const LEAVE_STATUSES: Record<LeaveStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#fdab3d" },
  approved: { label: "Approved", color: "#00c875" },
  rejected: { label: "Rejected", color: "#e2445c" },
  cancelled: { label: "Cancelled", color: "#c4c4c4" },
  revoked: { label: "Revoked", color: "#c4c4c4" },
};

export type LeaveSpan = { startDate: string; endDate: string; startPart: DayPart; endPart: DayPart };

// Days since 1970-01-01, so ranges compare as numbers in any timezone.
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const isoFromDay = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const isWeekend = (n: number) => [0, 6].includes(new Date(n * 86_400_000).getUTCDay());

export function addDays(iso: string, days: number) {
  return isoFromDay(dayNumber(iso) + days);
}

// Every day has two half-day slots (morning, afternoon). Two requests clash
// when their slots overlap, so a morning and an afternoon off can coexist.
function slots(s: LeaveSpan): [number, number] {
  return [dayNumber(s.startDate) * 2 + (s.startPart === "afternoon" ? 1 : 0), dayNumber(s.endDate) * 2 + (s.endPart === "morning" ? 0 : 1)];
}

export function spansOverlap(a: LeaveSpan, b: LeaveSpan) {
  const [a0, a1] = slots(a);
  const [b0, b1] = slots(b);
  return a0 <= b1 && b0 <= a1;
}

// What part of `iso` the leave takes, or null if none (weekends are never leave).
export function partOnDay(s: LeaveSpan, iso: string): DayPart | null {
  const d = dayNumber(iso);
  if (isWeekend(d) || iso < s.startDate || iso > s.endDate) return null;
  if (s.startDate === s.endDate) return s.startPart;
  if (iso === s.startDate) return s.startPart;
  if (iso === s.endDate) return s.endPart;
  return "full";
}

// Working days taken: weekends skipped, half days count 0.5.
export function workingDays(s: LeaveSpan) {
  let total = 0;
  for (let d = dayNumber(s.startDate); d <= dayNumber(s.endDate); d++) {
    const part = partOnDay(s, isoFromDay(d));
    if (part) total += part === "full" ? 1 : 0.5;
  }
  return total;
}

export function formatDays(n: number) {
  return `${n} working day${n === 1 ? "" : "s"}`;
}

const PART_LABEL = { full: "", morning: "morning", afternoon: "afternoon" } as const;

function formatDay(iso: string, withYear: boolean) {
  return new Date(dayNumber(iso) * 86_400_000).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

// "Mon, 17 Nov" · "Mon, 17 Nov (morning)" · "Mon, 17 Nov (afternoon) – Wed, 19 Nov"
export function formatLeaveSpan(s: LeaveSpan) {
  const withYear = s.startDate.slice(0, 4) !== String(new Date().getFullYear()) || s.endDate.slice(0, 4) !== s.startDate.slice(0, 4);
  const day = (iso: string, part: DayPart) => formatDay(iso, withYear) + (part === "full" ? "" : ` (${PART_LABEL[part]})`);
  if (s.startDate === s.endDate) return day(s.startDate, s.startPart);
  return `${day(s.startDate, s.startPart)} – ${day(s.endDate, s.endPart)}`;
}

// The parts a request may use: one day is full, morning or afternoon; longer
// leave may start in the afternoon and end in the morning.
export function partsAreValid(s: LeaveSpan) {
  if (s.startDate === s.endDate) return s.startPart === s.endPart;
  return s.startPart !== "morning" && s.endPart !== "afternoon";
}
