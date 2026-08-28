const { z } = require('zod');

const EnvSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(4000),
  MCP_API_KEYS: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  OPENROUTER_API_KEY: z.string().optional(),
  DEMO_MODE: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

const apiKeys = env.MCP_API_KEYS.split(',').map(s => s.trim()).filter(Boolean);
const demoMode = env.DEMO_MODE === '1';

if (!env.OPENROUTER_API_KEY && !demoMode) {
  console.error('Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key (or set DEMO_MODE=1).');
  process.exit(1);
}

if (apiKeys.length === 0) {
  console.warn('[config] MCP_API_KEYS is not set — the /mcp endpoint is UNAUTHENTICATED. Set it before exposing this server beyond localhost.');
}

module.exports = {
  port: env.MCP_PORT,
  apiKeys,
  logLevel: env.LOG_LEVEL,
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX
  },
  demoMode
};
