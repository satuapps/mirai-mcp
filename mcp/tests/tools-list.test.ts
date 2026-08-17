import { describe, expect, it, afterEach } from "vitest";
import { McpStdioClient } from "./helpers/mcpClient.js";

const EXPECTED_TOOLS = ["account_status", "call_model", "list_models"];

describe("tools/list without credentials", () => {
  let client: McpStdioClient | undefined;

  afterEach(() => {
    client?.close();
    client = undefined;
  });

  it("lists every tool with zero environment variables", async () => {
    const env = { ...process.env };
    delete env.MIRAI_API_KEY;
    delete env.MIRAI_BASE_URL;

    client = new McpStdioClient(env);
    await client.initialize();
    const names = await client.listTools();

    expect(names).toEqual(EXPECTED_TOOLS);
  });
});
