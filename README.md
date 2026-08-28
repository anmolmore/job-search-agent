# Job Search Agent

Finds real, currently open (posted in the last 7 days) India startup job
postings tailored to one candidate's profile, using a live web search via
[OpenRouter](https://openrouter.ai). Ships as two separate front ends over
one shared search implementation: a browser app for a person to use, and an
MCP server for an AI assistant to call directly.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the web app works, request by request
- [`docs/MCP_SERVER.md`](docs/MCP_SERVER.md) — what the MCP server adds and why

## Layout

```
lib/jobSearch.js     shared search logic — prompt, provider call, filtering, pricing
server.js            web app: serves public/ and POST /api/search
public/              browser UI
mcp-server/          MCP server exposing the same search as tools an AI agent can call
```

## Quick start — web app

```bash
cp .env.example .env
# add OPENROUTER_API_KEY, or set DEMO_MODE=1 to try it with no key
npm install
npm start
```

Open `http://localhost:3000`.

## Quick start — MCP server

```bash
cd mcp-server
cp .env.example .env
npm install
npm start
```

Listens on `http://localhost:4000/mcp`. See
[`docs/MCP_SERVER.md`](docs/MCP_SERVER.md) for connecting an AI assistant to
it or trying it with the MCP Inspector.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | both | Required unless `DEMO_MODE=1` |
| `OPENROUTER_MODEL` | both | Defaults to `openai/gpt-4o-mini` |
| `DEMO_MODE` | both | `1` returns sample data with no API call, for previewing at no cost |
| `PORT` | web app | Defaults to `3000` |
| `MCP_PORT` | mcp-server | Defaults to `4000` |
| `MCP_API_KEYS` | mcp-server | Comma-separated bearer tokens accepted on the MCP endpoint. Unset = open, with a warning logged on every request |

Neither server sends the API key to the browser — it is only ever read
server-side.
