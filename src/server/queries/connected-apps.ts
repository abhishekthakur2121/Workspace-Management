import "server-only";
import { db } from "@/server/db";

// The apps a person has connected (see /account/apps). A connection still
// works while it has an unused, unexpired refresh token; once that runs out
// the app has to be connected again.
export async function getConnectedApps(userId: string) {
  const now = new Date();
  const grants = await db.oAuthGrant.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      client: { select: { name: true } },
      tokens: { where: { kind: "refresh", usedAt: null, expiresAt: { gt: now } }, select: { hash: true }, take: 1 },
    },
  });
  return grants.map((g) => ({
    id: g.id,
    name: g.client.name,
    connectedAt: g.createdAt.toISOString(),
    lastUsedAt: g.lastUsedAt?.toISOString() ?? null,
    active: g.tokens.length > 0,
  }));
}

export type ConnectedApp = Awaited<ReturnType<typeof getConnectedApps>>[number];
