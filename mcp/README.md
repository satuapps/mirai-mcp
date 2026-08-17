# Mirai MCP server

[Model Context Protocol](https://modelcontextprotocol.io) server for the [Mirai](https://satuapps.com) affordable chat completions API.

**Positioning:** Mirai is the cheap model behind the agent you already run. Point your harness at `satuapps.com/v1` or install this MCP server and delegate bulk work to Mirai 1 and Mirai 2.

Works with **Hermes**, **OpenClaw**, Cursor, Claude Code, Codex, and other MCP hosts.

Install from npm:

```bash
npx -y @satuapps/mirai-mcp
```

## Tools

| Tool | Purpose |
|------|---------|
| `call_model` | Chat with Mirai. Guest daily quota works without a key. |
| `list_models` | Live catalog and per million token pricing from `GET /harga`. |
| `account_status` | Guest quota or paid balance and subscription windows. |

## Auth

| Variable | Required | Purpose |
|----------|----------|---------|
| `MIRAI_API_KEY` | No for discovery. Optional for paid API calls. | Bearer key for `/v1/*`. |
| `MIRAI_BASE_URL` | No | API host. Default `https://satuapps.com`. |

The process **starts and advertises tools with zero credentials**. Directory checks such as Glama can call `tools/list` without env vars. Tool calls use guest quota on `/publik/chat` until it runs out, then the error mentions how to create a free key at [satuapps.com/docs](https://satuapps.com/docs).

## Install snippets

`MIRAI_API_KEY` is optional. Omit `env` for guest quota, or set a key for paid calls.

### Cursor

`~/.cursor/mcp.json` or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mirai": {
      "command": "npx",
      "args": ["-y", "@satuapps/mirai-mcp"],
      "env": {
        "MIRAI_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add mirai --env MIRAI_API_KEY=YOUR_API_KEY -- npx -y @satuapps/mirai-mcp
```

### OpenClaw

```json
{
  "mcpServers": {
    "mirai": {
      "command": "npx",
      "args": ["-y", "@satuapps/mirai-mcp"],
      "env": { "MIRAI_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

### Hermes

```json
{
  "mcp": {
    "mirai": {
      "command": "npx",
      "args": ["-y", "@satuapps/mirai-mcp"],
      "env": { "MIRAI_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

## Run locally

```bash
cd mcp
npm install
npm run build
node dist/index.js
```

Optional key:

```bash
export MIRAI_API_KEY=YOUR_API_KEY
node dist/index.js
```

Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Docker (Glama)

```bash
cd mcp
docker build -t mirai-mcp .
docker run --rm -i mirai-mcp
```

The image starts over stdio with empty `MIRAI_API_KEY` and lists tools on initialize.

## MCPB bundle

Build a `.mcpb` bundle without publishing:

```bash
npm run mcpb
```

The artifact lands in `dist-mcpb/`.

## License

MIT. See [LICENSE](./LICENSE).
