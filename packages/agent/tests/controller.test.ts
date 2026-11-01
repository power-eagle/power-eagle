import { describe, expect, it, vi } from 'vitest';
import { AgentController, type AgentRequest } from '../src/index.js';
import { copy, deferred, textHost, writer } from './text-host.js';

describe('portable text-document workflow', () => {
  it('creates revisions and sends prior instructions with the explicitly selected earlier base', async () => {
    const fixture = textHost(); const prompts: string[] = [];
    const controller = new AgentController({ host: fixture.host, providers: [writer(async input => { prompts.push(input.prompt); return input.prompt; })] });
    await controller.draft('a', 'Always retain Lighthouse'); await controller.send('a');
    await controller.selectBase('a', 1); await controller.draft('a', 'Add Harbor'); await controller.send('a');
    expect(prompts[1]).toContain('Selected document: Blank document'); expect(prompts[1]).toContain('Always retain Lighthouse');
    expect(controller.record('a').turns.map(turn => [turn.id, turn.base, turn.revision])).toEqual([[1, 1, 2], [2, 1, 3]]);
    expect(fixture.documents.get('a')?.get(2)).toContain('Always retain Lighthouse');
  });

  it('isolates settings, request context and concurrent conversations during generation', async () => {
    const fixture = textHost(); const result = deferred<string>(); const requests: AgentRequest[] = [];
    const other = { ...writer(), id: 'other' };
    const controller = new AgentController({ host: fixture.host, providers: [writer(), other], generate: async request => {
      requests.push(copy(request)); return request.conversationId === 'a' ? result.promise : 'B result';
    } });
    await controller.context('a', 'dictionary', true); await controller.draft('a', 'First');
    const pending = controller.send('a'); await vi.waitFor(() => expect(requests).toHaveLength(1));
    await controller.send('a');
    await controller.settings('a', { provider: 'other', choices: {} }); await controller.context('a', 'dictionary', false);
    await controller.draft('a', 'New unsent draft'); await controller.draft('b', 'Independent'); await controller.send('b');
    result.resolve('A result'); await pending;
    expect(requests[0]).toMatchObject({ conversationId: 'a', choice: { provider: 'writer' }, context: { dictionary: true } });
    expect(controller.record('a').draft).toBe('New unsent draft'); expect(controller.record('b').turns[0].status).toBe('success');
    expect(controller.record('a').turns).toHaveLength(1); expect(controller.busy('a')).toBe(false);
  });

  it('links retries without replacing failures and protects drafts when editing', async () => {
    const fixture = textHost(); const requests: AgentRequest[] = [];
    const controller = new AgentController({ host: fixture.host, providers: [writer(), { ...writer(), id: 'backup' }], generate: async request => {
      requests.push(request); if (request.choice.provider === 'writer') throw Error('Unavailable'); return 'Recovered';
    } });
    await controller.context('a', 'dictionary', true); await controller.draft('a', 'Keep this request'); await controller.send('a');
    expect(controller.error('a')).toBeUndefined();
    await controller.draft('a', 'Keep my draft'); await expect(controller.editRequest('a', 1)).rejects.toThrow('draft has been kept');
    expect(controller.record('a').draft).toBe('Keep my draft');
    await controller.editRequest('a', 1, true); expect(controller.record('a').draft).toBe('Keep this request');
    await controller.settings('a', { provider: 'backup', choices: {} }); await controller.context('a', 'dictionary', false);
    await controller.retry('a', 1);
    expect(controller.record('a').turns).toMatchObject([{ id: 1, status: 'failed', error: 'Unavailable' }, { id: 2, retryOf: 1, status: 'success', base: 1, apiContext: { dictionary: true } }]);
    expect(requests[1].prompt).toContain('"applied":false');
    expect(controller.record('a').draft).toBe('Keep this request');
  });

  it('identifies legacy retry flags, excludes hidden requests and recovers interruption without sending', async () => {
    const fixture = textHost(); const generation = vi.fn(async () => 'Result');
    const controller = new AgentController({ host: fixture.host, providers: [writer(generation)] });
    await fixture.host.update('a', record => {
      record.nextTurnId = 4; record.context = { dictionary: true };
      record.turns = [
        { id: 1, base: 1, instruction: 'Old failure', status: 'failed', error: 'offline', choice: { provider: 'writer' }, createdAt: '' },
        { id: 2, base: 1, instruction: 'Hidden', status: 'failed', hidden: true, choice: { provider: 'writer' }, createdAt: '' },
        { id: 3, base: 1, instruction: 'Interrupted', status: 'pending', choice: { provider: 'writer' }, createdAt: '' },
      ];
    });
    await controller.recoverInterrupted(); expect(generation).not.toHaveBeenCalled(); expect(controller.record('a').turns[2].error).toContain('interrupted');
    await expect(controller.editRequest('a', 2)).rejects.toThrow('unavailable');
    await controller.retry('a', 1);
    expect(controller.record('a').turns[3]).toMatchObject({ id: 4, currentFlagsOnRetry: true, apiContext: { dictionary: true }, status: 'success' });
    expect(generation.mock.calls[0][0].prompt).not.toContain('Hidden');
  });

  it('leaves the draft intact when pending-record publication fails', async () => {
    const fixture = textHost(); const generate = vi.fn(async () => 'Result');
    const controller = new AgentController({ host: { ...fixture.host, update: async () => { throw Error('Disk unavailable'); } }, providers: [writer(generate)] });
    await fixture.host.update('a', record => { record.draft = 'Keep me'; });
    await controller.send('a');
    expect(controller.record('a').draft).toBe('Keep me'); expect(controller.record('a').turns).toEqual([]);
    expect(controller.error('a')).toBe('Disk unavailable'); expect(generate).not.toHaveBeenCalled();
  });

  it('records host application failure without inventing successful revisions', async () => {
    const fixture = textHost();
    const controller = new AgentController({ host: { ...fixture.host, apply: async () => { throw Error('Storage refused'); } }, providers: [writer()] });
    await controller.draft('a', 'Edit'); await controller.send('a');
    expect(controller.record('a').turns[0]).toMatchObject({ status: 'failed', error: 'Storage refused' });
    expect(fixture.documents.get('a')?.size).toBe(1); expect(controller.error('a')).toBeUndefined();
  });

  it('uses a composer fallback if recording a request failure also fails', async () => {
    const fixture = textHost(); let rejectUpdates = false;
    const host = { ...fixture.host, update: async (...args: Parameters<typeof fixture.host.update>) => {
      if (rejectUpdates) throw Error('Storage lost'); return fixture.host.update(...args);
    } };
    const controller = new AgentController({ host, providers: [writer(async () => { rejectUpdates = true; throw Error('Generation failed'); })] });
    await controller.draft('a', 'Edit'); await controller.send('a');
    expect(controller.error('a')).toBe('Generation failed'); expect(controller.record('a').turns[0].status).toBe('pending');
  });

  it('coalesces catalogs, preserves choices after failed refresh and rejects known unsupported effort', async () => {
    const fixture = textHost(); const provider = writer(); const discover = vi.fn(provider.adapter.discover); provider.adapter.discover = discover;
    const generate = vi.fn(provider.adapter.generate); provider.adapter.generate = generate;
    const controller = new AgentController({ host: fixture.host, providers: [provider] });
    await Promise.all([controller.discover('writer'), controller.discover('writer')]); expect(discover).toHaveBeenCalledTimes(1);
    await controller.settings('a', { provider: 'writer', choices: { writer: { model: 'text', effort: 'unsupported' } } });
    await controller.draft('a', 'Edit'); await controller.send('a'); expect(generate).not.toHaveBeenCalled();
    expect(controller.record('a').turns[0].error).toContain('effort is unavailable');
    discover.mockRejectedValueOnce(Error('Offline')); await controller.discover('writer', true);
    expect(controller.providerCatalog('writer')?.state).toBe('unavailable');
    expect(controller.record('a').settings.choices.writer.effort).toBe('unsupported');
    await controller.draft('a', 'Try configured choice'); await controller.send('a'); expect(generate).toHaveBeenCalledTimes(1);
  });

  it('copies caller settings, records and catalog data at public boundaries', async () => {
    const fixture = textHost(); const provider = writer();
    const controller = new AgentController({ host: fixture.host, providers: [provider] });
    const settings = { provider: 'writer', choices: { writer: { model: 'text' } } };
    const save = controller.settings('a', settings); settings.choices.writer.model = 'mutated'; await save;
    const record = controller.record('a'); record.settings.choices.writer.model = 'also mutated';
    await controller.discover('writer'); controller.providerCatalog('writer')!.models[0].efforts.push('unsafe');
    expect(controller.record('a').settings.choices.writer.model).toBe('text');
    expect(controller.providerCatalog('writer')!.models[0].efforts).toEqual(['low']);
    provider.label = 'Changed'; expect(controller.provider('writer')?.label).toBe('Text writer');
  });

  it('rejects duplicate registrations and records unknown-provider failures without fallback', async () => {
    const fixture = textHost(); expect(() => new AgentController({ host: fixture.host, providers: [writer(), writer()] })).toThrow('unique');
    const controller = new AgentController({ host: fixture.host, providers: [writer()] });
    await expect(controller.settings('a', { provider: 'missing', choices: {} })).rejects.toThrow('unavailable');
    await fixture.host.update('a', record => { record.settings.provider = 'missing'; record.draft = 'Edit'; });
    await controller.send('a'); expect(controller.record('a').turns[0].error).toContain('missing');
  });

  it('rejects ownership mismatch and mandatory context overflow before dispatch', async () => {
    const fixture = textHost(); const generate = vi.fn(async () => 'Result');
    const controller = new AgentController({ host: fixture.host, providers: [writer(generate)], inputBudget: 1 });
    await controller.draft('a', 'Edit'); await controller.send('a'); expect(generate).not.toHaveBeenCalled();
    expect(controller.record('a').turns[0].error).toContain('not truncated');
    const wrong = new AgentController({ host: { ...fixture.host, read: () => fixture.host.read('b') }, providers: [writer()] });
    expect(() => wrong.record('a')).toThrow('ownership');
  });
});
