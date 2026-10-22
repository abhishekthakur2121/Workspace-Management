// Due dates are plain calendar days ("YYYY-MM-DD") with no time zone. They are
// compared as strings and shown in the viewer's own locale and calendar.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function isoToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Oct 24", or "Oct 24, 2027" outside the current year.
export function formatDue(iso: string) {
  const date = isoToLocalDate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

// A task is overdue when its due day has passed and it isn't done.
export function isOverdue(due: string | null, done: boolean | undefined) {
  return !!due && !done && due < todayISO();
}
