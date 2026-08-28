const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { searchJobs, PROFILE, MODEL, DEMO_MODE } = require('../../lib/jobSearch');
const logger = require('./lib/logger');
const metrics = require('./lib/metrics');

const filterFields = {
  roles: z.array(z.string()).optional()
    .describe('Role focus, e.g. "ml-engineer", "ai-lead", "founding-engineer", "cto", "backend", "mlops", "data-science", "product". Omit for all.'),
  stages: z.array(z.string()).optional()
    .describe('Startup funding stage, e.g. "seed", "series-a", "series-b", "series-c". Omit for all.'),
  domains: z.array(z.string()).optional()
    .describe('Sector, e.g. "healthtech", "ai-ml", "fintech", "devtools", "saas", "edtech", "data-infra". Omit for all.'),
  locations: z.array(z.string()).optional()
    .describe('Location, e.g. "bengaluru", "remote", "hyderabad", "mumbai", "delhi". Omit for all.')
};

/**
 * Builds a fresh McpServer instance. Called once per HTTP session (see index.js)
 * so state never leaks across clients/tenants.
 */
function createMcpServer() {
  const server = new McpServer(
    { name: 'startup-job-agent', version: '1.0.0' },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        'Finds real, currently-open (last 7 days) India startup job postings tailored to a specific ' +
        'senior candidate profile, using live web search via OpenRouter. Call find_jobs with optional ' +
        'role/stage/domain/location filters. Call get_candidate_profile to see who the search is tailored to.'
    }
  );

  server.registerTool(
    'find_jobs',
    {
      title: 'Find startup jobs',
      description:
        'Searches the live web (Wellfound, LinkedIn, Instahyre, Cutshort, YC Work at a Startup) for real, ' +
        'currently open India startup job postings from the last 7 days, matched and scored against the ' +
        "candidate's profile. Never fabricates listings — returns fewer results rather than inventing one. " +
        'Each result includes a real apply URL, an honest match score, and specific match reasoning.',
      inputSchema: filterFields,
      annotations: { readOnlyHint: true, openWorldHint: true, title: 'Find startup jobs' }
    },
    async ({ roles, stages, domains, locations }) => {
      metrics.recordCall('find_jobs');
      logger.info({ roles, stages, domains, locations }, 'find_jobs: request');
      try {
        const result = await searchJobs({ roles, stages, domains, locations });
        metrics.recordUsage(result.usage);
        logger.info(
          { jobCount: result.jobs.length, costUsd: result.usage?.estCostUsd },
          'find_jobs: completed'
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err) {
        metrics.recordError('find_jobs');
        logger.error({ err: err.message }, 'find_jobs: failed');
        return {
          content: [{ type: 'text', text: `Job search failed: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'get_candidate_profile',
    {
      title: 'Get candidate profile',
      description: 'Returns the candidate profile that find_jobs matches and scores every posting against.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false, title: 'Get candidate profile' }
    },
    async () => {
      metrics.recordCall('get_candidate_profile');
      return { content: [{ type: 'text', text: PROFILE }] };
    }
  );

  server.registerTool(
    'get_usage_stats',
    {
      title: 'Get server usage stats',
      description:
        'Returns cumulative usage for this server process: tool call counts, error counts, and total ' +
        'estimated OpenRouter spend since startup — for cost observability during a demo or ops review.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false, title: 'Get usage stats' }
    },
    async () => {
      metrics.recordCall('get_usage_stats');
      return { content: [{ type: 'text', text: JSON.stringify(metrics.snapshot(), null, 2) }] };
    }
  );

  server.registerResource(
    'candidate-profile',
    'profile://candidate',
    {
      title: 'Candidate profile',
      description: 'The senior technical profile every job search is tailored to.',
      mimeType: 'text/plain'
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: PROFILE }]
    })
  );

  server.registerResource(
    'server-config',
    'config://server',
    {
      title: 'Server configuration',
      description: 'Non-secret runtime configuration for this MCP server.',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({ model: MODEL, demoMode: DEMO_MODE }, null, 2)
      }]
    })
  );

  server.registerPrompt(
    'job_search_brief',
    {
      title: 'Job search brief',
      description: 'Kicks off a tailored job search conversation with sensible defaults pre-filled.',
      argsSchema: {
        focus: z.string().optional().describe('Optional free-text steer, e.g. "prioritize remote roles"')
      }
    },
    async ({ focus }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              'Use find_jobs to search for the best-matching current India startup roles for this candidate. ' +
              'Call get_candidate_profile first if you need the background details. ' +
              (focus ? `Additional guidance: ${focus}` : 'Use broad default filters.')
          }
        }
      ]
    })
  );

  return server;
}

module.exports = { createMcpServer };
