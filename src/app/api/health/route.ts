import { connection } from "next/server";
import { db } from "@/server/db";

export async function GET() {
  await connection(); // always run at request time, never prerender
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up", latencyMs: Date.now() - started });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
