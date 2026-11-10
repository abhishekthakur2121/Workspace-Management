"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";

// Revoking an app ends its access at once: its tokens stop working on the
// next request and can't be refreshed.
export async function revokeApp(input: { id: string }) {
  const user = await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(input);
  const done = await db.oAuthGrant.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (done.count === 0) return { error: "This app no longer has access." };
  refresh();
  return { ok: true as const };
}
