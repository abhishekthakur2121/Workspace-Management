import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { getFeedEntries, getFeedToken } from "@/server/queries/leave";
import { addDays, type DayPart } from "@/lib/leave";

// Team leave as an iCalendar feed (/api/calendar/<secret>.ics) that Outlook
// and other calendar apps can subscribe to. The secret in the link is the
// only protection, so the feed shows who is away and when, nothing more.
// Super admins can change the secret from the Leave page.

export async function GET(_req: Request, ctx: RouteContext<"/api/calendar/[file]">) {
  await connection();
  const { file } = await ctx.params;
  const given = Buffer.from(file.replace(/\.ics$/, ""));
  const expected = Buffer.from(await getFeedToken());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Not found", { status: 404 });
  }

  const entries = await getFeedEntries();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nxt Workspace Manager//Team leave//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Team leave",
    // Hints for how often apps refresh; Outlook may still take a few hours.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...entries.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}@nxt-workspace-manager`,
      `DTSTAMP:${stamp(e.updatedAt)}`,
      `DTSTART;VALUE=DATE:${compact(e.startDate)}`,
      `DTEND;VALUE=DATE:${compact(addDays(e.endDate, 1))}`, // the day after (exclusive)
      `SUMMARY:${escape(`${e.name} – away${partsNote(e)}`)}`,
      "TRANSP:TRANSPARENT", // shows as free, so it doesn't block anyone's calendar
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="team-leave.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}

function partsNote(e: { startDate: string; endDate: string; startPart: DayPart; endPart: DayPart }) {
  if (e.startDate === e.endDate) return e.startPart === "full" ? "" : ` (${e.startPart})`;
  const notes = [e.startPart === "afternoon" && "from the afternoon", e.endPart === "morning" && "back in the afternoon"].filter(Boolean);
  return notes.length ? ` (${notes.join(", ")})` : "";
}

const compact = (iso: string) => iso.replaceAll("-", "");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

// iCalendar lines are at most 75 bytes; longer ones continue after CRLF + space.
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
    }
    current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}
