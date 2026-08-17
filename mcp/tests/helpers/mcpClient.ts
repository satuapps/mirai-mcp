import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export class McpStdioClient {
  private child: ChildProcessWithoutNullStreams;
  private stdout = "";
  private stderr = "";
  private nextId = 1;

  constructor(env: NodeJS.ProcessEnv) {
    const entry = path.join(ROOT, "dist/index.js");
    this.child = spawn(process.execPath, [entry], {
      cwd: ROOT,
      env: { ...env, MIRAI_API_KEY: "", MIRAI_BASE_URL: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.stdout += chunk;
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
  }

  private send(msg: Record<string, unknown>) {
    this.child.stdin.write(`${JSON.stringify(msg)}\n`);
  }

  private async waitForId(id: number, timeoutMs = 12000): Promise<JsonRpcResponse> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const lines = this.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as JsonRpcResponse;
          if (parsed.id === id) return parsed;
        } catch {
          // ignore partial json lines
        }
      }
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(`timed out waiting for id=${id}\nstdout:\n${this.stdout}\nstderr:\n${this.stderr}`);
  }

  async initialize(): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    this.send({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mirai-mcp-test", version: "0.1.0" },
      },
    });
    const init = await this.waitForId(id);
    if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
    this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return init;
  }

  async listTools(): Promise<string[]> {
    const id = this.nextId++;
    this.send({ jsonrpc: "2.0", id, method: "tools/list", params: {} });
    const listed = await this.waitForId(id);
    if (listed.error) throw new Error(`tools/list failed: ${JSON.stringify(listed.error)}`);
    const tools = (listed.result as { tools?: Array<{ name: string }> })?.tools ?? [];
    return tools.map((t) => t.name).sort();
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    this.send({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    });
    return this.waitForId(id);
  }

  close() {
    this.child.stdin.end();
    this.child.kill("SIGTERM");
  }
}
