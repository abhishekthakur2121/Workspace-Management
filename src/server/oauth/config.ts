import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getPublicOrigin } from "mcp-handler";

// The OAuth authorization server behind the MCP endpoint: where apps learn
// how to ask for access, and the lifetimes of what they get.

// One permission covers everything the MCP tools do. offline_access is
// accepted (some apps ask for it to get a refresh token, which every
// connection gets anyway) but not stored.
export const SCOPE = "tasks";
export const SUPPORTED_SCOPES = [SCOPE, "offline_access"];

export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The public address the app is reached at (the same rule the MCP handler
// uses), so every URL handed out matches what the client typed.
export function originOf(source: Request | Headers) {
  if (source instanceof Request) return getPublicOrigin(source);
  const host = source.get("x-forwarded-host")?.split(",")[0].trim() || source.get("host");
  const proto = source.get("x-forwarded-proto")?.split(",")[0].trim() || (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function endpoints(origin: string) {
  return {
    issuer: origin,
    resource: `${origin}/api/mcp`,
    authorize: `${origin}/oauth/authorize`,
    token: `${origin}/api/oauth/token`,
    register: `${origin}/api/oauth/register`,
  };
}

// Codes and tokens: 32 random bytes, with a prefix that says what they are
// (handy in logs and for secret scanners). Only the SHA-256 is stored.
export const newSecret = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

// Public endpoints that browser-based clients (like the MCP Inspector) call
// directly. Nothing here relies on cookies, so any origin may read them.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });
