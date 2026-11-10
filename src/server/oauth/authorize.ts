import "server-only";
import { db } from "@/server/db";
import { CODE_TTL_MS, SCOPE, endpoints, hashSecret, newSecret } from "@/server/oauth/config";
import { findClient, redirectMatches, type OAuthClientInfo } from "@/server/oauth/clients";

// The /oauth/authorize request: an app sends the person here to approve it.

export type AuthorizeRequest = {
  client: OAuthClientInfo;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
};

type Parsed =
  | { ok: true; request: AuthorizeRequest }
  // Not safe to send the person back to the app: show this instead.
  | { ok: false; message: string }
  // The app is known, so the error goes back to it, as OAuth expects.
  | { ok: false; redirect: string };

export async function parseAuthorizeRequest(params: Record<string, string | undefined>, origin: string): Promise<Parsed> {
  const { client_id, redirect_uri, state } = params;
  const client = client_id ? await findClient(client_id) : null;
  if (!client) return { ok: false, message: "This app couldn't be identified, so it can't be connected." };
  if (!redirect_uri || !redirectMatches(client.redirectUris, redirect_uri)) {
    return { ok: false, message: "This app gave an address to return to that it didn't register, so it can't be connected." };
  }

  const back = (error: string, description: string) => ({
    ok: false as const,
    redirect: withParams(redirect_uri, { error, error_description: description, state, iss: origin }),
  });
  if (params.response_type !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (params.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(params.code_challenge ?? "")) {
    return back("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  if (params.resource && params.resource.replace(/\/$/, "") !== endpoints(origin).resource) {
    return back("invalid_target", "Unknown resource.");
  }
  return { ok: true, request: { client, redirectUri: redirect_uri, codeChallenge: params.code_challenge!, state: state ?? null } };
}

// After the person approves: a one-time code the app swaps for tokens.
export async function issueCode(request: AuthorizeRequest, userId: string, origin: string) {
  const code = newSecret("nxc");
  await db.oAuthCode.create({
    data: {
      hash: hashSecret(code),
      clientId: request.client.id,
      userId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scopes: [SCOPE],
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return withParams(request.redirectUri, { code, state: request.state, iss: origin });
}

export function deniedRedirect(request: AuthorizeRequest, origin: string) {
  return withParams(request.redirectUri, {
    error: "access_denied",
    error_description: "The person declined to connect this app.",
    state: request.state,
    iss: origin,
  });
}

function withParams(uri: string, params: Record<string, string | null | undefined>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return url.toString();
}
