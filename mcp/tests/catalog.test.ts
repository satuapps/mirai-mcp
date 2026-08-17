import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MiraiClient } from "../src/client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("list_models catalog source", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns pricing from the public catalog endpoint, not hardcoded numbers", async () => {
    const catalog = {
      object: "list",
      data: [
        {
          id: "mirai-1",
          object: "model",
          pricing: { prompt_per_1m_usd: 0.31, completion_per_1m_usd: 1.11 },
        },
        {
          id: "mirai-2",
          object: "model",
          pricing: { prompt_per_1m_usd: 0.61, completion_per_1m_usd: 1.61 },
        },
      ],
    };

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      expect(String(input)).toBe("https://example.test/harga");
      return new Response(JSON.stringify(catalog), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MiraiClient({ apiKey: "", baseUrl: "https://example.test" });
    const models = await client.listModels();

    expect(models).toHaveLength(2);
    expect(models[0]?.pricing?.prompt_per_1m_usd).toBe(0.31);
    expect(models[1]?.pricing?.prompt_per_1m_usd).toBe(0.61);
  });

  it("does not embed catalog prices as literals in source files", () => {
    const srcDir = path.join(ROOT, "src");
    const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
    const forbidden = [/0\.25/, /0\.50/, /1\.00/, /1\.50/];
    for (const file of files) {
      const text = readFileSync(path.join(srcDir, file), "utf8");
      for (const pattern of forbidden) {
        expect(text, `${file} must not hardcode ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
