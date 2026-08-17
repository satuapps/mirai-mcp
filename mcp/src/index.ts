#!/usr/bin/env node
/**
 * Mirai MCP server (stdio).
 *
 * Env:
 *   MIRAI_API_KEY   optional. Guest quota works without it. Tool calls use the
 *                   paid API when set.
 *   MIRAI_BASE_URL  optional, default https://satuapps.com
 *
 * The process starts without credentials so directory checks can list tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MiraiClient } from "./client.js";
import { CHAT_URL, DEFAULT_BASE_URL, DOCS_URL } from "./constants.js";
import { registerTools } from "./tools.js";

const PACKAGE_VERSION = "0.1.0";

function createServer(): McpServer {
  const apiKey = process.env.MIRAI_API_KEY?.trim() ?? "";
  const baseUrl = process.env.MIRAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const client = new MiraiClient({ apiKey, baseUrl });

  if (!apiKey) {
    console.error(
      "[mirai-mcp] MIRAI_API_KEY is unset; tools are advertised and guest quota " +
        "may work until it runs out. Create a free key via " +
        `${DOCS_URL} or try ${CHAT_URL} without a key.`,
    );
  }

  const server = new McpServer({
    name: "mirai",
    version: PACKAGE_VERSION,
  });

  server.registerResource(
    "mirai-overview",
    "mirai://overview",
    {
      title: "Mirai MCP overview",
      description: "Affordable model backend for the agents you already run",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "mirai://overview",
          mimeType: "text/markdown",
          text: [
            "# Mirai MCP",
            "",
            "Cheap chat completions for Hermes, OpenClaw, and other agent harnesses.",
            `- Docs and API key setup: ${DOCS_URL}`,
            `- Web chat with free daily quota: ${CHAT_URL}`,
            "",
            "## Tools",
            "- `call_model`, chat with Mirai 1 or Mirai 2",
            "- `list_models`, live catalog and pricing",
            "- `account_status`, guest quota or paid balance",
          ].join("\n"),
        },
      ],
    }),
  );

  registerTools(server, client);
  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mirai-mcp] running on stdio (v${PACKAGE_VERSION})`);
}

main().catch((err) => {
  console.error("[mirai-mcp] fatal:", err);
  process.exit(1);
});
