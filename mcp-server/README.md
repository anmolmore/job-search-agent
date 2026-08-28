# Startup Job Agent — MCP Server

Exposes the same live job search as the web app, but as an [MCP](https://modelcontextprotocol.io)
server any MCP client (Claude Desktop, Claude Code, custom agents) can call directly.

## What's here

| Capability | Name | What it does |
|---|---|---|
| Tool | `find_jobs` | Live web search (via OpenRouter) for real India startup jobs posted in the last 7 days, filtered/scored against a candidate profile |
| Tool | `get_candidate_profile` | Returns the profile every search is matched against |
| Tool | `get_usage_stats` | Cumulative call counts, error counts, and $ spend since server start |
| Resource | `profile://candidate` | Same candidate profile, as an MCP resource |
| Resource | `config://server` | Non-secret runtime config (model name, demo mode) |
| Prompt | `job_search_brief` | Pre-built prompt to kick off a tailored search |

Shares its search logic (`../lib/jobSearch.js`) with the web app in this repo — one code path, two front ends.

## Enterprise-grade pieces

- **Streamable HTTP transport** with per-session state (`Mcp-Session-Id` header) — supports multiple concurrent clients, not just one stdio pipe.
- **Bearer-token auth** (`MCP_API_KEYS`) on `/mcp` and `/metrics`. Unset = open (logs a warning on every request) so local demo works with zero config.
- **Rate limiting** on the MCP endpoint (`RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`).
- **Structured JSON logging** (pino) with per-request correlation via `pino-http`.
- **Health check** (`GET /healthz`, unauthenticated — for load balancers / k8s liveness probes) and **metrics endpoint** (`GET /metrics`, authenticated).
- **Graceful shutdown** — closes all active MCP sessions on `SIGTERM`/`SIGINT` before exiting.
- **Env validation at boot** (Zod) — refuses to start with a bad config instead of failing mid-request.
- **Dockerfile** with a non-root user and container `HEALTHCHECK`.

## Run it

```bash
cd mcp-server
cp .env.example .env   # add your OPENROUTER_API_KEY, or set DEMO_MODE=1
npm install
npm start
```

Server listens on `http://localhost:4000/mcp`.

## Try it with the MCP Inspector

The server must already be running (`npm start`, in its own terminal) — the Inspector is a separate
UI that connects to it over HTTP, it does not spawn the server itself:

```bash
npm run inspect
```

This opens a browser UI. In it:
1. **Transport type:** `Streamable HTTP`
2. **URL:** `http://localhost:4000/mcp`
3. **Authorization header:** `Bearer demo-key-change-me` (or whatever you set `MCP_API_KEYS` to — skip if unset)
4. Click **Connect**, then use the **Tools** tab to call `find_jobs`, `get_candidate_profile`, or `get_usage_stats` and inspect the JSON-RPC traffic live — the fastest way to demo this without wiring up a full client.

## Point Claude Desktop / Claude Code at it

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "startup-job-agent": {
      "url": "http://localhost:4000/mcp",
      "headers": { "Authorization": "Bearer demo-key-change-me" }
    }
  }
}
```

Drop the `headers` block if you left `MCP_API_KEYS` unset.

## Docker

Build from the **repo root** (the image needs both `mcp-server/` and the shared `lib/`):

```bash
docker build -f mcp-server/Dockerfile -t job-agent-mcp .
docker run -p 4000:4000 --env-file mcp-server/.env job-agent-mcp
```

## Auth model for a real deployment

`MCP_API_KEYS` is a comma-separated bearer-token allowlist — fine for a demo or a handful of trusted
clients. For production multi-tenant use, swap `src/lib/auth.js` for OAuth 2.1 (the MCP spec's
recommended auth flow) or your existing identity provider; the rest of the server is unaffected since
auth is isolated to one middleware.
