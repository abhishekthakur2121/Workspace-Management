import { CORS, SUPPORTED_SCOPES, endpoints, originOf, preflight } from "@/server/oauth/config";

// RFC 8414: how apps ask for access. Public clients only (no secrets), PKCE
// required, and apps may identify themselves either by registering or by a
// published metadata document (client_id_metadata_document_supported).

export function GET(req: Request) {
  const urls = endpoints(originOf(req));
  return Response.json(
    {
      issuer: urls.issuer,
      authorization_endpoint: urls.authorize,
      token_endpoint: urls.token,
      registration_endpoint: urls.register,
      scopes_supported: SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    },
    { headers: { ...CORS, "Cache-Control": "max-age=3600" } },
  );
}

export const OPTIONS = preflight;
