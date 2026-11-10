import { CORS, originOf, preflight } from "@/server/oauth/config";
import { exchangeCode, refreshTokens } from "@/server/oauth/tokens";

// The token endpoint: one-time codes and refresh tokens in, tokens out.
// Requests are form-encoded (RFC 6749); JSON is accepted too.

const noStore = { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(req: Request) {
  const form = req.headers.get("content-type")?.includes("application/json")
    ? new URLSearchParams(await req.json().catch(() => ({})))
    : new URLSearchParams(await req.text());

  const grantType = form.get("grant_type");
  const result =
    grantType === "authorization_code"
      ? await exchangeCode(form, originOf(req))
      : grantType === "refresh_token"
        ? await refreshTokens(form)
        : { ok: false as const, error: "unsupported_grant_type", description: "Use authorization_code or refresh_token." };

  if (!result.ok) return Response.json({ error: result.error, error_description: result.description }, { status: 400, headers: noStore });
  return Response.json(result.body, { headers: noStore });
}

export const OPTIONS = preflight;
