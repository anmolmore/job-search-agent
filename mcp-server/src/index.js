require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');

const config = require('./lib/config');
const logger = require('./lib/logger');
const metrics = require('./lib/metrics');
const { requireApiKey } = require('./lib/auth');
const { createMcpServer } = require('./mcpServer');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }));

// -- Health & readiness (unauthenticated, for load balancers / k8s probes) --
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: metrics.snapshot().uptimeSeconds, demoMode: config.demoMode });
});

app.get('/metrics', requireApiKey, (req, res) => {
  res.json(metrics.snapshot());
});

// -- Rate limiting on the MCP endpoint only --
const mcpLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { jsonrpc: '2.0', error: { code: -32000, message: 'Rate limit exceeded' }, id: null }
});

// -- Session registry: one MCP server + transport per client session --
const sessions = new Map(); // sessionId -> { server, transport }

async function handleMcpPost(req, res) {
  const sessionId = req.headers['mcp-session-id'];

  try {
    if (sessionId && sessions.has(sessionId)) {
      const { transport } = sessions.get(sessionId);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { server, transport });
          logger.info({ sessionId: sid, activeSessions: sessions.size }, 'session initialized');
        },
        onsessionclosed: (sid) => {
          sessions.delete(sid);
          logger.info({ sessionId: sid, activeSessions: sessions.size }, 'session closed');
        }
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: no valid session ID and not an initialize request' },
      id: null
    });
  } catch (err) {
    logger.error({ err: err.message }, 'unhandled error in /mcp POST');
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
}

async function handleMcpSessionRequest(req, res) {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  const { transport } = sessions.get(sessionId);
  await transport.handleRequest(req, res);
}

app.post('/mcp', requireApiKey, mcpLimiter, handleMcpPost);
app.get('/mcp', requireApiKey, handleMcpSessionRequest);   // SSE stream for server->client notifications
app.delete('/mcp', requireApiKey, handleMcpSessionRequest); // explicit session termination

// -- Error handler (catches JSON parse errors etc.) --
app.use((err, req, res, next) => {
  logger.error({ err: err.message }, 'express error handler');
  res.status(400).json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
});

const httpServer = app.listen(config.port, () => {
  logger.info(
    { port: config.port, demoMode: config.demoMode, authEnabled: config.apiKeys.length > 0 },
    `Startup Job Agent MCP server listening on http://localhost:${config.port}/mcp`
  );
});

async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  httpServer.close(() => logger.info('http server closed'));
  for (const [sessionId, { transport }] of sessions) {
    try {
      await transport.close();
    } catch (err) {
      logger.warn({ sessionId, err: err.message }, 'error closing session during shutdown');
    }
  }
  sessions.clear();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled promise rejection');
});
