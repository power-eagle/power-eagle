import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { createClaudeProvider, createCodexProvider, type GenerationInput } from '../src/index.js';
import { claudeModels, generationArguments as claudeArgs, parseOutput as claudeOutput } from '../src/claude.js';
import { codexModels, generationArguments as codexArgs, parseOutput as codexOutput } from '../src/codex.js';
type LocalProvider = 'claude' | 'codex';
type ProviderRequest = { prompt: string; choice: { provider: LocalProvider; model?: string; effort?: string } };
const generationArguments = (request: ProviderRequest, directory: string) => request.choice.provider === 'claude' ? claudeArgs({ ...request.choice, prompt: request.prompt }) : codexArgs({ ...request.choice, prompt: request.prompt }, directory);
const parseProviderOutput = (provider: LocalProvider, output: string) => provider === 'claude' ? claudeOutput(output) : codexOutput(output);
function localProviders(hostRequire: NodeRequire) {
  const adapters = { claude: createClaudeProvider({ hostRequire, executable: 'claude-fixture' }), codex: createCodexProvider({ hostRequire, executable: 'codex-fixture' }) };
  return { available: (id: LocalProvider) => adapters[id].available(), discover: (id: LocalProvider) => adapters[id].discover(), generate: (request: ProviderRequest) => adapters[request.choice.provider].generate({ ...request.choice, prompt: request.prompt } as GenerationInput) };
}

const realRequire = createRequire(import.meta.url);
const request: ProviderRequest = { prompt: 'Synthetic prompt', choice: { provider: 'codex', model: 'model-a', effort: 'low' } };
afterEach(() => vi.useRealTimers());
function fixture(respond: (input: string, child: EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill(): boolean }, args: string[]) => void,
  version?: () => string) {
  const directories: string[] = [], killed: number[] = [];
  const spawn = vi.fn((_exe: string, args: string[], options: { cwd: string }) => {
    if (args[0] !== '--version') directories.push(options.cwd);
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(),
      kill: () => { killed.push(1); queueMicrotask(() => child.emit('close', null)); return true; },
      stdin: new Writable({ write(chunk, _encoding, done) { if (args[0] !== '--version') respond(chunk.toString(), child, args); done(); } }),
    });
    if (args[0] === '--version') queueMicrotask(() => {
      child.stdout.write(version?.() ?? (_exe.includes('claude') ? '2.1.266 (Claude Code)' : 'codex-cli 0.162.0-alpha.17.2'));
      child.emit('close', 0);
    });
    return child;
  });
  const host = ((name: string) => name === 'node:child_process' ? { spawn } : realRequire(name)) as NodeRequire;
  return { providers: localProviders(host), spawn, directories, killed };
}
describe('local provider boundary', () => {
  it('maps actual discovery envelopes and preserves reported effort support', () => {
    expect(claudeModels([{ value: 'default', displayName: 'Default', supportsEffort: true, supportedEffortLevels: ['low'] }])).toEqual([{ id: 'default', label: 'Default', isDefault: true, efforts: ['low'] }]);
    expect(codexModels({ data: [{ model: 'a', displayName: 'A', isDefault: true, supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }, { model: 'hidden', displayName: 'Hidden', hidden: true, isDefault: false, supportedReasoningEfforts: [] }] }).models).toHaveLength(1);
    expect(() => claudeModels([{ bad: true }])).toThrow();
  });
  it('parses responses and classifies errors without exposing raw diagnostics', () => {
    expect(parseProviderOutput('codex', JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } }))).toBe('{}');
    expect(parseProviderOutput('claude', '{"result":"{}"}')).toBe('{}');
    expect(() => parseProviderOutput('claude', '{"is_error":true,"result":"unauthorized secret-token"}')).toThrow('authentication failed');
    expect(() => parseProviderOutput('codex', '{"type":"turn.failed","error":"rate limit"}')).toThrow('usage limit');
    expect(() => parseProviderOutput('codex', '{}')).toThrow('no response');
  });
  it('uses explicit model/effort and restrictive invocation arguments', () => {
    const args = generationArguments(request, 'temporary');
    expect(args).toContain('--ignore-user-config'); expect(args).toContain('read-only'); expect(args).toContain('features.shell_tool=false');
    expect(args).toContain('project_doc_max_bytes=0'); expect(args).toContain('model-a'); expect(args).toContain('model_reasoning_effort="low"');
    const claude = generationArguments({ ...request, choice: { provider: 'claude', effort: 'high' } }, 'temporary');
    expect(claude).toContain('--safe-mode'); expect(claude).toContain('--strict-mcp-config'); expect(claude[claude.indexOf('--tools') + 1]).toBe('');
  });
  it('discovers Codex pages without a generation prompt and kills the control process before cleanup', async () => {
    const fake = fixture((input, child) => {
      const message = JSON.parse(input);
      if (!message.id) return;
      const result = message.method === 'initialize' ? {} : { data: [{ model: message.id === 2 ? 'a' : 'b', displayName: 'Model', isDefault: message.id === 2, supportedReasoningEfforts: [] }], nextCursor: message.id === 2 ? 'next' : null };
      queueMicrotask(() => child.stdout.write(JSON.stringify({ id: message.id, result }) + '\n'));
    }, () => 'codex-cli 0.999.0-beta.1+build');
    expect((await fake.providers.discover('codex')).map(model => model.id)).toEqual(['a', 'b']);
    expect(fake.killed).toHaveLength(1); expect(existsSync(fake.directories[0])).toBe(false);
    expect(fake.spawn.mock.calls[1][1][0]).toBe('app-server');
  });
  it('discovers Claude through initialization only and rejects malformed catalogs', async () => {
    const fake = fixture((input, child) => {
      const message = JSON.parse(input); expect(message.request.subtype).toBe('initialize');
      queueMicrotask(() => child.stdout.write(JSON.stringify({ type: 'control_response', response: { request_id: 'models', subtype: 'success', response: { models: [{ value: 'x', displayName: 'X' }] } } }) + '\n'));
    }, () => '2.99.0-beta.1+build (Claude Code)');
    expect((await fake.providers.discover('claude'))[0].id).toBe('x'); expect(fake.killed).toHaveLength(1);
    const malformed = fixture((_input, child) => { queueMicrotask(() => child.stdout.write('not-json\n')); });
    await expect(malformed.providers.discover('claude')).rejects.toThrow('invalid model catalog');
    expect(existsSync(malformed.directories[0])).toBe(false);
  });
  it('bounds timeout and output, releases temporary files and does not fall back to Eagle', async () => {
    vi.useFakeTimers();
    const stalled = fixture(() => {});
    const pending = expect(stalled.providers.generate(request)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(120_000); await pending;
    expect(stalled.killed).toHaveLength(1); expect(existsSync(stalled.directories[0])).toBe(false);
    vi.useRealTimers();
    const oversized = fixture((_input, child) => { queueMicrotask(() => child.stdout.write('x'.repeat(4_000_001))); });
    await expect(oversized.providers.generate(request)).rejects.toThrow('size limit');
    expect(existsSync(oversized.directories[0])).toBe(false);
  });
  it('transports the prompt on stdin with shell disabled and cleans up a successful invocation', async () => {
    const fake = fixture((input, child) => {
      expect(input).toBe(request.prompt);
      queueMicrotask(() => { child.stdout.write('{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}\n'); child.emit('close', 0); });
    });
    expect(await fake.providers.generate(request)).toBe('{}');
    expect(fake.spawn.mock.calls[0][2]).toMatchObject({ shell: false, windowsHide: true });
    expect(existsSync(fake.directories[0])).toBe(false);
  });
  it.each([
    ['codex', 'codex-cli 0.999.1+build'], ['codex', 'codex-cli 0.999.0-alpha.1'],
    ['claude', '2.99.1 (Claude Code)'], ['claude', '2.99.0-beta.1+build (Claude Code)'],
  ] as const)('accepts %s upgrades for availability and generation: %s', async (provider, version) => {
    const fake = fixture((_input, child) => queueMicrotask(() => {
      child.stdout.write(provider === 'claude' ? '{"result":"{}"}' : '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}\n');
      child.emit('close', 0);
    }), () => version);
    expect(await fake.providers.available(provider)).toBe(true);
    expect(await fake.providers.generate({ ...request, choice: { provider } })).toBe('{}');
    expect(fake.spawn.mock.calls.map(call => call[1][0])).toEqual(['--version', '--version', provider === 'claude' ? '--print' : 'exec']);
  });
  it.each(['codex', 'claude'] as LocalProvider[])('rechecks %s at both protocol boundaries after an upgrade', async provider => {
    let version = provider === 'claude' ? '2.1.266 (Claude Code)' : 'codex-cli 0.162.0-alpha.17.2';
    const fake = fixture(() => { throw new Error('Protocol must not start'); }, () => version);
    expect(await fake.providers.available(provider)).toBe(true);
    version = provider === 'claude' ? '3.0.0 (Claude Code)' : 'codex-cli 1.0.0';
    await expect(fake.providers.available(provider)).rejects.toThrow('bridge compatibility review');
    await expect(fake.providers.discover(provider)).rejects.toThrow('bridge compatibility review');
    await expect(fake.providers.generate({ ...request, choice: { provider } })).rejects.toThrow('bridge compatibility review');
    expect(fake.spawn.mock.calls.every(call => call[1][0] === '--version')).toBe(true);
  });
  it.each(['codex', 'claude'] as LocalProvider[])('reports unrecognizable %s versions before protocol use', async provider => {
    const fake = fixture(() => { throw new Error('Protocol must not start'); }, () => 'unknown');
    await expect(fake.providers.available(provider)).rejects.toThrow('unrecognized version');
    await expect(fake.providers.discover(provider)).rejects.toThrow('unrecognized version');
    await expect(fake.providers.generate({ ...request, choice: { provider } })).rejects.toThrow('unrecognized version');
    expect(fake.spawn.mock.calls.every(call => call[1][0] === '--version')).toBe(true);
  });
  it('imports and constructs without a host and reports missing runtime only on invocation', async () => {
    const codex = createCodexProvider(); const claude = createClaudeProvider();
    await expect(codex.available()).rejects.toThrow('module loader');
    await expect(claude.discover()).rejects.toThrow('module loader');
  });
  it('cleans up a broken stdin pipe after child termination', async () => {
    const fake = fixture((_input, child) => {
      queueMicrotask(() => (child as typeof child & { stdin: Writable }).stdin.emit('error', new Error('EPIPE private data')));
    });
    await expect(fake.providers.generate(request)).rejects.toThrow('connection closed');
    expect(fake.killed).toHaveLength(1);
    expect(existsSync(fake.directories[0])).toBe(false);
  });
  it.each(['claude', 'codex'] as const)('does not touch the other provider while using %s', async provider => {
    const fake = fixture((_input, child) => queueMicrotask(() => {
      child.stdout.write(provider === 'claude' ? '{"result":"plain text"}' : '{"type":"item.completed","item":{"type":"agent_message","text":"plain text"}}\n'); child.emit('close', 0);
    }));
    expect(await fake.providers.available(provider)).toBe(true);
    expect(await fake.providers.generate({ prompt: 'Neutral text', choice: { provider } })).toBe('plain text');
    expect(fake.spawn.mock.calls.every(call => call[0] === `${provider}-fixture`)).toBe(true);
  });
});
