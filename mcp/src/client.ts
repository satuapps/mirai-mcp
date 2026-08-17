import { HEADER_TAMU, KEY_HINT } from "./constants.js";

export class MiraiApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly kode: string | undefined;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "MiraiApiError";
    this.status = status;
    this.data = data;
    this.kode =
      data && typeof data === "object" && "kode" in data
        ? String((data as { kode?: string }).kode)
        : undefined;
  }
}

export type MiraiClientOptions = {
  apiKey: string;
  baseUrl?: string;
  guestId?: string;
  fetchImpl?: typeof fetch;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ModelPricing = {
  prompt_per_1m_usd?: number;
  completion_per_1m_usd?: number;
  gambar?: {
    prompt_per_1m_usd?: number;
    completion_per_1m_usd?: number;
    min_token_masukan?: number;
  };
  rentang?: unknown;
};

export type PublicModel = {
  id: string;
  object?: string;
  description?: string;
  pricing?: ModelPricing;
};

export type CallModelResult = {
  content: string;
  model?: string;
  usage?: unknown;
  kuota?: unknown;
};

function randomGuestId(): string {
  return `mcp-${crypto.randomUUID()}`;
}

export class MiraiClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  private guestId: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ apiKey, baseUrl = "https://satuapps.com", guestId, fetchImpl }: MiraiClientOptions) {
    this.apiKey = apiKey.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.guestId = guestId?.trim() || randomGuestId();
    this.fetchImpl = fetchImpl ?? fetch;
  }

  private async request(
    method: string,
    path: string,
    { body, headers }: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const reqHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "@satuapps/mirai-mcp",
      ...headers,
    };

    const init: RequestInit = { method, headers: reqHeaders };
    if (body !== undefined) {
      reqHeaders["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const res = await this.fetchImpl(url, init);
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // non JSON body
    }

    if (!res.ok) {
      const envelope =
        data && typeof data === "object" && "error" in data
          ? (data as { error?: { message?: string; kode?: string } }).error
          : undefined;
      const msg =
        envelope?.message ||
        (data && typeof data === "object" && "message" in data
          ? String((data as { message?: string }).message)
          : null) ||
        `HTTP ${res.status}`;
      throw new MiraiApiError(msg, res.status, envelope ?? data);
    }

    return data;
  }

  async listModels(): Promise<PublicModel[]> {
    const data = (await this.request("GET", "/harga")) as {
      data?: PublicModel[];
    };
    return Array.isArray(data.data) ? data.data : [];
  }

  async accountStatus(): Promise<unknown> {
    if (this.apiKey) {
      return this.request("GET", "/v1/balance", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    }
    return this.request("GET", "/publik/kuota", {
      headers: { [HEADER_TAMU]: this.guestId },
    });
  }

  async callModel(args: {
    messages: ChatMessage[];
    model?: string;
    max_tokens?: number;
  }): Promise<CallModelResult> {
    if (this.apiKey) {
      const data = (await this.request("POST", "/v1/chat/completions", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: {
          model: args.model ?? "mirai-1",
          messages: args.messages,
          max_tokens: args.max_tokens,
          stream: false,
        },
      })) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: unknown;
      };
      return {
        content: data.choices?.[0]?.message?.content ?? "",
        model: data.model,
        usage: data.usage,
      };
    }

    const data = (await this.request("POST", "/publik/chat", {
      headers: { [HEADER_TAMU]: this.guestId },
      body: {
        messages: args.messages,
        model: args.model,
        stream: false,
      },
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
      kuota?: unknown;
      model?: string;
      usage?: unknown;
    };

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage,
      kuota: data.kuota,
    };
  }
}

export function quotaHint(err: MiraiApiError): string | undefined {
  if (err.kode === "login_required" || err.kode === "perlu_masuk") {
    return KEY_HINT;
  }
  if (err.status === 401) {
    return KEY_HINT;
  }
  return undefined;
}

export function formatApiError(err: unknown): { message: string; hint?: string } {
  if (err instanceof MiraiApiError) {
    return {
      message: err.message,
      hint: quotaHint(err),
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { message };
}
