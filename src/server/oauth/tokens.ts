import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { ACCESS_TTL_S, REFRESH_TTL_MS, endpoints, hashSecret, newSecret } from "@/server/oauth/config";

// The /api/oauth/token grants, and the access-token check behind /api/mcp.
//  - authorization_code: the one-time code plus the PKCE verifier becomes a
//    connection (grant) with an access token (1 hour) and a refresh token.
//  - refresh_token: swaps a refresh token for a new pair. Each refresh token
//    works once; presenting a used one again means it was copied, so the
//    whole connection is cut off (OAuth 2.1 refresh token rotation).

type TokenResult =
  | { ok: true; body: Record<string, string | number> }
  | { ok: false; error: string; description: string };

const fail = (error: string, description: string): TokenResult => ({ ok: false, error, description });
const invalidGrant = fail("invalid_grant", "The code or refresh token is invalid, expired or already used.");
const revoke = (grantId: string) => db.oAuthGrant.updateMany({ where: { id: grantId, revokedAt: null }, data: { revokedAt: new Date() } });

export async function exchangeCode(form: URLSearchParams, origin: string): Promise<TokenResult> {
  const code = form.get("code");
  const verifier = form.get("code_verifier");
  const clientId = form.get("client_id");
  if (!code || !verifier || !clientId) return fail("invalid_request", "code, code_verifier and client_id are required.");
  const resource = form.get("resource");
  if (resource && resource.replace(/\/$/, "") !== endpoints(origin).resource) return fail("invalid_target", "Unknown resource.");

  const hash = hashSecret(code);
  const row = await db.oAuthCode.findUnique({ where: { hash } });
  if (!row || row.clientId !== clientId) return invalidGrant;
  if (row.usedAt) {
    // A replayed code: whoever has it shouldn't keep what the first use got.
    if (row.grantId) await revoke(row.grantId);
    return invalidGrant;
  }
  if (row.expiresAt < new Date() || form.get("redirect_uri") !== row.redirectUri) return invalidGrant;
  if (createHash("sha256").update(verifier).digest("base64url") !== row.codeChallenge) return invalidGrant;

  // Claim the code; if two requests race, only one wins.
  const claimed = await db.oAuthCode.updateMany({ where: { hash, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return invalidGrant;
  const user = await db.user.findUnique({ where: { id: row.userId }, select: { active: true } });
  if (!user?.active) return invalidGrant;

  const grant = await db.oAuthGrant.create({ data: { userId: row.userId, clientId, scopes: row.scopes }, select: { id: true, scopes: true } });
  await db.oAuthCode.update({ where: { hash }, data: { grantId: grant.id } });
  return { ok: true, body: await issueTokens(grant) };
}

export async function refreshTokens(form: URLSearchParams): Promise<TokenResult> {
  const token = form.get("refresh_token");
  const clientId = form.get("client_id");
  if (!token || !clientId) return fail("invalid_request", "refresh_token and client_id are required.");

  const hash = hashSecret(token);
  const row = await db.oAuthToken.findUnique({
    where: { hash },
    select: { kind: true, expiresAt: true, usedAt: true, grant: { select: { id: true, clientId: true, scopes: true, revokedAt: true, user: { select: { active: true } } } } },
  });
  if (!row || row.kind !== "refresh" || row.grant.clientId !== clientId || row.grant.revokedAt) return invalidGrant;
  if (row.usedAt) {
    await revoke(row.grant.id);
    return invalidGrant;
  }
  if (row.expiresAt < new Date() || !row.grant.user.active) return invalidGrant;

  const claimed = await db.oAuthToken.updateMany({ where: { hash, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return invalidGrant;
  return { ok: true, body: await issueTokens(row.grant) };
}

async function issueTokens(grant: { id: string; scopes: string[] }) {
  const access = newSecret("nxa");
  const refresh = newSecret("nxr");
  const now = Date.now();
  await db.oAuthToken.createMany({
    data: [
      { hash: hashSecret(access), grantId: grant.id, kind: "access", expiresAt: new Date(now + ACCESS_TTL_S * 1000) },
      { hash: hashSecret(refresh), grantId: grant.id, kind: "refresh", expiresAt: new Date(now + REFRESH_TTL_MS) },
    ],
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: grant.scopes.join(" ") };
}

// The connection and person behind an access token, if it's still good.
export async function findAccessToken(token: string) {
  if (!token.startsWith("nxa_")) return null;
  const row = await db.oAuthToken.findUnique({
    where: { hash: hashSecret(token) },
    select: {
      kind: true,
      expiresAt: true,
      grant: {
        select: {
          id: true,
          clientId: true,
          scopes: true,
          revokedAt: true,
          lastUsedAt: true,
          user: { select: { id: true, role: true, name: true, email: true, active: true, mustChangePassword: true } },
        },
      },
    },
  });
  if (!row || row.kind !== "access" || row.expiresAt <= new Date() || row.grant.revokedAt) return null;
  return { ...row.grant, expiresAt: Math.floor(row.expiresAt.getTime() / 1000) };
}
