import { generateProtectedResourceMetadata } from "mcp-handler";
import { CORS, SUPPORTED_SCOPES, endpoints, originOf, preflight } from "@/server/oauth/config";

// RFC 9728: tells MCP clients that /api/mcp needs a token, and which
// authorization server issues it. The 401 from /api/mcp points here; clients
// may also ask with the resource path appended (…/oauth-protected-resource/api/mcp).

export function GET(req: Request) {
  const urls = endpoints(originOf(req));
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [urls.issuer],
    resourceUrl: urls.resource,
    additionalMetadata: { scopes_supported: SUPPORTED_SCOPES, bearer_methods_supported: ["header"], resource_name: "Nxt Workspace Manager" },
  });
  return Response.json(metadata, { headers: { ...CORS, "Cache-Control": "max-age=3600" } });
}

export const OPTIONS = preflight;
