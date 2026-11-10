import "server-only";
import { after } from "next/server";
import { getPublicOrigin } from "mcp-handler";
import type { AuthInfo, ServerContext } from "@modelcontextprotocol/server";
import { db } from "@/server/db";
import type { Actor } from "@/server/access";
import { findAccessToken } from "@/server/oauth/tokens";

// The person an MCP request acts for. Tools only ever see this, so they run
// with exactly that person's access, as if they were using the app. `app` is
// the connected app's name, recorded on every change it makes.
export type McpCaller = Actor & { name: string | null; email: string; origin: string; app: string };

const LAST_USED_EVERY_MS = 5 * 60 * 1000;

// Checks the bearer token on an MCP request. Returning nothing makes the
// handler answer 401 with a pointer to where the client can sign in.
export async function verifyMcpToken(req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const grant = await findAccessToken(token);
  // Deactivated people lose access on their next request, as in the app.
  if (!grant?.user.active || grant.user.mustChangePassword) return undefined;

  // "Last used" for the connected apps list; written after the response, and
  // at most every few minutes.
  if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    after(() => db.oAuthGrant.update({ where: { id: grant.id }, data: { lastUsedAt: new Date() } }));
  }

  const { id, role, name, email } = grant.user;
  const caller: McpCaller = { id, role, name, email, origin: getPublicOrigin(req), app: grant.client.name };
  return { token, clientId: grant.clientId, scopes: grant.scopes, expiresAt: grant.expiresAt, extra: { caller } };
}

export function callerOf(ctx: ServerContext): McpCaller {
  const caller = ctx.http?.authInfo?.extra?.caller as McpCaller | undefined;
  if (!caller) throw new Error("MCP request without a verified caller");
  return caller;
}
