import { CORS, preflight } from "@/server/oauth/config";
import { registerClient } from "@/server/oauth/clients";

// RFC 7591 dynamic client registration: an app posts its name and redirect
// URIs and gets a client id. Registering grants nothing by itself; the person
// still has to sign in and approve the app. Apps never approved are removed by
// the daily clean-up.

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "Send the client metadata as JSON." }, { status: 400, headers: CORS });
  }
  const result = await registerClient(body);
  if ("error" in result) {
    return Response.json({ error: result.error, error_description: result.description }, { status: 400, headers: CORS });
  }
  return Response.json(result.client, { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export const OPTIONS = preflight;
