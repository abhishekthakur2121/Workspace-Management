import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { INSTRUCTIONS, registerTools } from "@/server/mcp/tools";
import { verifyMcpToken } from "@/server/mcp/auth";

// The MCP endpoint (/api/mcp): lets MCP clients read and work with tasks on
// behalf of a signed-in person. Requests without a valid token get a 401 that
// tells the client where to sign in.

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "nxt-workspace-manager", version: "1.0.0" },
  instructions: INSTRUCTIONS,
});

const handler = withMcpAuth(mcp, verifyMcpToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
