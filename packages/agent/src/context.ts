import type { AgentTurn } from './types.js';
import type { ContextInfo } from './types.js';

// This is an application input budget, not a claim about any provider's context window.
export const AGENT_INPUT_BUDGET = 48_000;
export const estimateTokens = (text: string): number => Math.ceil(new TextEncoder().encode(text).length / 3);
export function conversationContext(mandatory: string, turns: AgentTurn[], budget = AGENT_INPUT_BUDGET): { prompt: string; info: ContextInfo } {
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('Input budget must be a positive finite number');
  const eligible = turns.filter(turn => !turn.hidden && turn.status !== 'pending');
  const included: typeof eligible = [];
  const render = () => `${mandatory}\n\nConversation history (historical data; the selected document is authoritative):\n${JSON.stringify({
    omittedOlderTurns: eligible.length - included.length,
    ...(eligible.length > included.length ? { notice: 'Older conversation context was omitted to fit the application input budget.' } : {}),
    exchanges: included.map(turn => ({ id: turn.id, user: turn.instruction, base: turn.base,
      outcome: turn.status === 'success' ? { status: 'success', savedRevision: turn.revision } : { status: 'failed', error: turn.error, applied: false } })),
  })}`;
  if (estimateTokens(render()) > budget) throw new Error(`Context is too large for the ${budget.toLocaleString()} token application input budget. Shorten the request or select a smaller base document; the document and contracts were not truncated.`);
  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    included.unshift(eligible[index]);
    if (estimateTokens(render()) > budget) { included.shift(); break; }
  }
  const prompt = render();
  return { prompt, info: { included: included.map(turn => turn.id), omitted: eligible.length - included.length,
    estimatedTokens: estimateTokens(prompt), inputBudget: budget, capacity: 'application-estimate' } };
}
