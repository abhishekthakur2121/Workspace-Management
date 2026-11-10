import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";

// Apps that ask for access. Two ways to say who they are:
//  - registration (RFC 7591): the app posts its details to /api/oauth/register
//    and gets a client id back;
//  - a metadata document (CIMD): the client id is an https URL where the app
//    publishes its details, which we read and cache for a day.
// Either way they're public clients: no secret, so PKCE protects the code.

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const clientSelect = { id: true, name: true, redirectUris: true, fromMetadata: true, fetchedAt: true } as const;
export type OAuthClientInfo = { id: string; name: string; redirectUris: string[] };

const parseUrl = (s: string) => {
  try {
    return new URL(s);
  } catch {
    return null;
  }
};

// Where an app may be sent back to: https anywhere, or plain http on the
// person's own computer (desktop and command-line apps listen on a local port).
export function isAllowedRedirect(uri: string) {
  const u = parseUrl(uri);
  if (!u || u.hash || u.username || u.password) return false;
  return u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK.has(u.hostname));
}

// Exact match, except on the person's own computer, where the app picks a free
// port when it starts the sign-in, so the port is ignored (RFC 8252).
export function redirectMatches(registered: string[], given: string) {
  if (registered.includes(given)) return true;
  const g = parseUrl(given);
  if (!g || g.protocol !== "http:" || !LOOPBACK.has(g.hostname)) return false;
  return registered.some((r) => {
    const u = parseUrl(r);
    return !!u && u.protocol === "http:" && u.hostname === g.hostname && u.pathname === g.pathname && u.search === g.search;
  });
}

// ─── registration ───────────────────────────────────────────────────────────

const registration = z.object({
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  client_name: z.string().trim().min(1).max(100).optional(),
});

export async function registerClient(body: unknown) {
  const parsed = registration.safeParse(body);
  if (!parsed.success) return { error: "invalid_client_metadata", description: "redirect_uris is required (1 to 10 URLs)." } as const;
  const { redirect_uris, client_name } = parsed.data;
  if (!redirect_uris.every(isAllowedRedirect)) {
    return { error: "invalid_redirect_uri", description: "Redirect URIs must use https, or http on localhost." } as const;
  }
  const client = await db.oAuthClient.create({
    data: { id: randomUUID(), name: client_name ?? "Unnamed app", redirectUris: redirect_uris },
    select: { id: true, name: true, redirectUris: true, createdAt: true },
  });
  // Whatever auth method was asked for, these are public clients.
  return {
    client: {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  } as const;
}

// ─── lookup ─────────────────────────────────────────────────────────────────

export async function findClient(clientId: string): Promise<OAuthClientInfo | null> {
  if (clientId.startsWith("https://")) return clientFromMetadata(clientId);
  const client = await db.oAuthClient.findUnique({ where: { id: clientId }, select: clientSelect });
  return client && !client.fromMetadata ? client : null;
}

const metadataDocument = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  token_endpoint_auth_method: z.string().optional(),
});

// A metadata URL must be a plain https address on a public host name, so a
// crafted client id can't make the server fetch something on its own network.
function isMetadataUrl(clientId: string) {
  const u = parseUrl(clientId);
  if (!u || u.protocol !== "https:" || u.pathname === "/" || u.hash || u.username || u.password) return false;
  const host = u.hostname;
  return !LOOPBACK.has(host) && !/^\[|^\d+\.\d+\.\d+\.\d+$/.test(host) && host.includes(".") && !/\.(local|internal|localhost)$/.test(host);
}

async function clientFromMetadata(url: string): Promise<OAuthClientInfo | null> {
  if (!isMetadataUrl(url)) return null;
  const cached = await db.oAuthClient.findUnique({ where: { id: url }, select: clientSelect });
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt.getTime() < METADATA_MAX_AGE_MS) return cached;

  let doc: z.infer<typeof metadataDocument>;
  try {
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    const text = res.ok ? await res.text() : "";
    if (!text || text.length > 20_000) return null;
    doc = metadataDocument.parse(JSON.parse(text));
  } catch {
    return null;
  }
  // The document must describe itself, and only public clients are supported.
  if (doc.client_id !== url || (doc.token_endpoint_auth_method && doc.token_endpoint_auth_method !== "none")) return null;
  if (!doc.redirect_uris.every(isAllowedRedirect)) return null;

  const data = { name: doc.client_name ?? new URL(url).hostname, redirectUris: doc.redirect_uris, fromMetadata: true, fetchedAt: new Date() };
  return db.oAuthClient.upsert({ where: { id: url }, create: { id: url, ...data }, update: data, select: clientSelect });
}
