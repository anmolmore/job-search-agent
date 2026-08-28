/**
 * Minimal in-memory usage tracker. Enough for a demo's observability story
 * (the get_usage_stats tool reads from this); swap for a real metrics
 * backend (Prometheus, OpenTelemetry) before production use.
 */
const state = {
  startedAt: new Date().toISOString(),
  totalCalls: 0,
  totalErrors: 0,
  totalCostUsd: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  toolCalls: {}
};

function recordCall(toolName) {
  state.totalCalls += 1;
  state.toolCalls[toolName] = (state.toolCalls[toolName] || 0) + 1;
}

function recordError(toolName) {
  state.totalErrors += 1;
}

function recordUsage(usage) {
  if (!usage) return;
  if (typeof usage.estCostUsd === 'number') state.totalCostUsd += usage.estCostUsd;
  if (typeof usage.prompt_tokens === 'number') state.totalPromptTokens += usage.prompt_tokens;
  if (typeof usage.completion_tokens === 'number') state.totalCompletionTokens += usage.completion_tokens;
}

function snapshot() {
  return {
    ...state,
    totalCostUsd: Number(state.totalCostUsd.toFixed(4)),
    uptimeSeconds: Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)
  };
}

module.exports = { recordCall, recordError, recordUsage, snapshot };
