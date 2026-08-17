import { describe, expect, it, vi, beforeEach } from "vitest";
import { MiraiClient, MiraiApiError } from "../src/client.js";
import { errorResult } from "../src/tools.js";

function textPayload(result: { content?: Array<{ text?: string }> }) {
  return result.content?.[0]?.text ?? "";
}

describe("call_model guest and quota paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("succeeds without API key when guest quota is available", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/publik/chat")) {
        expect(init?.headers).toMatchObject({ "X-Mirai-Tamu": expect.any(String) });
        expect(init?.headers).not.toHaveProperty("Authorization");
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "hello from mirai" } }],
            kuota: { sisa: 9, batas: 10 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MiraiClient({ apiKey: "", baseUrl: "https://example.test" });
    const reply = await client.callModel({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(reply.content).toBe("hello from mirai");
  });

  it("fails with key guidance when guest quota is exhausted", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            kode: "login_required",
            message: "Kuota gratis habis. Masuk untuk lanjut dengan saldo atau langganan.",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new MiraiClient({ apiKey: "", baseUrl: "https://example.test" });
    await expect(
      client.callModel({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({
      name: "MiraiApiError",
      status: 401,
    });

    const result = errorResult(
      new MiraiApiError(
        "Kuota gratis habis. Masuk untuk lanjut dengan saldo atau langganan.",
        401,
        { kode: "login_required" },
      ),
    );
    const body = textPayload(result);
    expect(body).toMatch(/Kuota gratis habis/i);
    expect(body).toMatch(/MIRAI_API_KEY/i);
    expect(body).toMatch(/satuapps\.com\/docs/i);
    expect(result.isError).toBe(true);
  });

  it("uses API key route when MIRAI_API_KEY is set", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/chat/completions")) {
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer test-key-abc",
        });
        return new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "paid path" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MiraiClient({
      apiKey: "test-key-abc",
      baseUrl: "https://example.test",
    });
    const reply = await client.callModel({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(reply.content).toBe("paid path");
  });
});

describe("MiraiApiError shape", () => {
  it("wraps publik error envelope", () => {
    const err = new MiraiApiError(
      "Kuota gratis habis. Masuk untuk lanjut dengan saldo atau langganan.",
      401,
      { kode: "login_required" },
    );
    expect(err.kode).toBe("login_required");
  });
});
