import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerVideoTools } from "./tools/videos";
import { registerAccountTools } from "./tools/accounts";
import { registerResearchTools } from "./tools/research";
import { registerAppTools } from "./tools/apps";
import { registerAnalyticsTools } from "./tools/analytics";

export function createServer() {
  const server = new McpServer(
    {
      name: "social-dashboard",
      version: "1.0.0",
    },
    {
      capabilities: { logging: {} },
    }
  );

  registerVideoTools(server);
  registerAccountTools(server);
  registerResearchTools(server);
  registerAppTools(server);
  registerAnalyticsTools(server);

  return server;
}
