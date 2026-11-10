"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";

// Disconnecting an app ends its connection at once: its tokens stop working
// on the next request and can't be refreshed.
export async function disconnectApp(input: { id: string }) {
  const user = await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(input);
  const done = await db.oAuthGrant.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (done.count === 0) return { error: "That app isn't connected any more." };
  refresh();
  return { ok: true as const };
}
