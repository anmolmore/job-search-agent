const crypto = require('crypto');
const config = require('./config');
const logger = require('./logger');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Bearer-token auth middleware. No-op (open access) when MCP_API_KEYS is unset,
 * so local/demo use works out of the box — but every unauthenticated pass is logged
 * at warn level so it's visible in an enterprise deployment's logs.
 */
function requireApiKey(req, res, next) {
  if (config.apiKeys.length === 0) {
    logger.warn({ path: req.path }, 'request served without authentication (MCP_API_KEYS unset)');
    return next();
  }

  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    logger.warn({ path: req.path, ip: req.ip }, 'rejected: missing bearer token');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized: missing or malformed Authorization header' },
      id: null
    });
  }

  const match = config.apiKeys.some(key => timingSafeEqual(key, token));
  if (!match) {
    logger.warn({ path: req.path, ip: req.ip }, 'rejected: invalid API key');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized: invalid API key' },
      id: null
    });
  }

  next();
}

module.exports = { requireApiKey };
