function estimateTextCost(model, usage = {}) {
  const pricing = {
    'gpt-5.6-luna': { input: 1, output: 6 },
    'gpt-5.6-terra': { input: 2.5, output: 15 },
    'gpt-5.6-sol': { input: 5, output: 30 }
  };
  const rate = pricing[model];
  if (!rate) return null;
  return Number((((usage.input_tokens || 0) * rate.input + (usage.output_tokens || 0) * rate.output) / 1_000_000).toFixed(6));
}

function usageSummary(model, usage = {}) {
  return {
    model,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    estimatedCostUsd: estimateTextCost(model, usage)
  };
}

module.exports = { usageSummary };
