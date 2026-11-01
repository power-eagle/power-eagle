import { describe, expect, it } from 'vitest';
import { conversationContext, estimateTokens } from './agent-context';
import type { PluginConversation } from './model';

const turn = (id: number, instruction: string, status: 'success' | 'failed' = 'success'): PluginConversation['turns'][number] => ({
  id, base: 1, instruction, status, createdAt: '2026-10-21T00:00:00.000Z', choice: { provider: 'eagle' },
  ...(status === 'success' ? { revision: id + 1 } : { error: 'Failed before activation' }),
});
describe('bounded conversation context', () => {
  it('keeps full history with outcomes and excludes hidden and pending instructions', () => {
    const turns = [turn(1, 'Keep the blue label'), turn(2, 'Failed change', 'failed'), { ...turn(3, 'hidden'), hidden: true }, { ...turn(4, 'current once'), status: 'pending' as const }];
    const before = JSON.stringify(turns);
    const result = conversationContext('Selected base document: {"label":"blue"}\nUser instruction: current once', turns);
    expect(result.info.included).toEqual([1, 2]); expect(result.info.omitted).toBe(0);
    expect(result.prompt).toContain('Keep the blue label'); expect(result.prompt).toContain('"applied":false');
    expect(result.prompt).not.toContain('hidden'); expect(result.prompt.match(/current once/g)).toHaveLength(1);
    expect(JSON.stringify(turns)).toBe(before);
  });
  it('retains newest complete exchanges within budget, with an explicit omission', () => {
    const turns = [turn(1, 'Old '.repeat(300)), turn(2, 'Latest correction')];
    const budget = estimateTokens(conversationContext('mandatory', [turns[1]]).prompt) + 80;
    const result = conversationContext('mandatory', turns, budget);
    expect(result.info.included).toEqual([2]); expect(result.info.omitted).toBe(1);
    expect(result.info.estimatedTokens).toBeLessThanOrEqual(budget);
    expect(result.prompt).toContain('omitted'); expect(result.prompt).toContain('Latest correction');
    expect(turns[0].instruction).toHaveLength(1200);
  });
  it('rejects mandatory overflow without slicing JSON and counts UTF-8 rather than characters', () => {
    expect(estimateTokens('你好')).toBe(2);
    expect(() => conversationContext('你好'.repeat(1000), [], 100)).toThrow('not truncated');
    const full = conversationContext('document', []);
    expect(conversationContext('document', [], full.info.estimatedTokens).prompt).toBe(full.prompt);
    expect(() => conversationContext('document', [], full.info.estimatedTokens - 1)).toThrow('too large');
  });
});
