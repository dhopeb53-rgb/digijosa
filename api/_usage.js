function estimateTextCost(model, usage = {}) {
  const inputRate = Number(process.env.GEMINI_INPUT_USD_PER_MILLION);
  const outputRate = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION);
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return null;
  return Number((((usage.promptTokenCount || 0) * inputRate + (usage.candidatesTokenCount || 0) * outputRate) / 1_000_000).toFixed(6));
}

function usageSummary(model, usage = {}) {
  return {
    model,
    provider: 'gemini',
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
    estimatedCostUsd: estimateTextCost(model, usage)
  };
}

module.exports = { usageSummary };
