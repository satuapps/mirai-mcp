import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiraiApiError, MiraiClient, formatApiError } from "./client.js";
import { DOCS_URL } from "./constants.js";

function text(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
}

export function errorResult(err: unknown) {
  if (err instanceof MiraiApiError) {
    const formatted = formatApiError(err);
    return text(
      {
        error: true,
        status: err.status,
        kode: err.kode,
        message: formatted.message,
        hint:
          formatted.hint ??
          (err.status === 401
            ? `Set MIRAI_API_KEY. Create a free key via ${DOCS_URL}.`
            : undefined),
        data: err.data,
      },
      true,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return text({ error: true, message }, true);
}

export function registerTools(server: McpServer, client: MiraiClient): void {
  server.registerTool(
    "call_model",
    {
      title: "Call Mirai model",
      description:
        "Send a chat to Mirai and return the assistant reply. Works without MIRAI_API_KEY " +
        "while daily guest quota remains. With a key, uses the OpenAI compatible API.",
      inputSchema: {
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]).describe("Only user and assistant roles are allowed"),
              content: z.string().describe("Message text"),
            }),
          )
          .min(1)
          .describe("Conversation messages, oldest first"),
        model: z
          .string()
          .optional()
          .describe("Optional model id such as mirai-1 or mirai-2. Guest calls default to mirai-1."),
        max_tokens: z.number().int().positive().optional().describe("Optional output token cap"),
      },
    },
    async (args) => {
      try {
        const result = await client.callModel(args);
        return text(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "list_models",
    {
      title: "Model catalog and pricing",
      description:
        "List Mirai models with public per million token pricing from the live catalog endpoint.",
      inputSchema: {},
    },
    async () => {
      try {
        const models = await client.listModels();
        return text({ models, source: "GET /harga" });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "account_status",
    {
      title: "Balance and quota",
      description:
        "Show remaining guest quota without a key, or plan balance and subscription windows with MIRAI_API_KEY.",
      inputSchema: {},
    },
    async () => {
      try {
        const status = await client.accountStatus();
        return text(status);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
