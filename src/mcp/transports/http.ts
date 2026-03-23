import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../server";

const API_KEY = process.env.MCP_API_KEY;
const PORT = parseInt(process.env.MCP_PORT || "3100", 10);

async function main() {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  createHttpServer(async (req, res) => {
    if (API_KEY) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${API_KEY}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    await transport.handleRequest(req, res);
  }).listen(PORT);

  console.error(
    `Social Dashboard MCP Server running on http://localhost:${PORT}`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
