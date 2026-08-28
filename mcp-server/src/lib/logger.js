const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.logLevel,
  base: { service: 'startup-job-agent-mcp' },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
