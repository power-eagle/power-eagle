import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as cp from 'node:child_process';
import { createCliTransport } from '../src/transport.js';
import { createClaudeProvider, createCodexProvider } from '../src/index.js';

const require = createRequire(import.meta.url);
const fixtureRoots: string[] = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('agent-provider-test-')) throw Error('Unexpected fixture root');
    fs.rmSync(root, { recursive: true, force: true });
  }
});
function script(source: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-provider-test-'));
  fixtureRoots.push(root);
  const file = path.join(root, 'fixture.cjs');
  fs.writeFileSync(file, source);
  return file;
}

describe('owned native processes', () => {
  it('waits for child close before releasing a successful working directory', async () => {
    const file = script("process.stdin.resume(); process.stdin.on('end',()=>{require('fs').writeFileSync('owned.txt','ok'); process.stdout.write('plain text');});");
    let closed = false; let directory = '';
    const hostRequire = (id: string) => id === 'node:child_process' ? {
      spawn: (...args: Parameters<typeof cp.spawn>) => {
        const child = cp.spawn(...args); child.on('close', () => { closed = true; expect(fs.existsSync(directory)).toBe(true); }); return child;
      },
    } : require(id);
    const transport = createCliTransport('codex', { hostRequire, executable: process.execPath });
    expect(await transport.temporary(async root => { directory = root; return transport.run([file], root, 'hello', 2000); })).toBe('plain text');
    expect(closed).toBe(true); expect(fs.existsSync(directory)).toBe(false);
  });

  it.each([
    ["process.stderr.write('unauthorized PRIVATE-SECRET'); process.exit(1);", 'authentication failed', 2000],
    ["setInterval(()=>{},1000);", 'timed out', 150],
    ["process.stdout.write('x'.repeat(4000001)); setInterval(()=>{},1000);", 'size limit', 2000],
  ] as const)('cleans up real failure: %s', async (source, expected, timeout) => {
    const file = script(source); let directory = '';
    const transport = createCliTransport('codex', { hostRequire: require, executable: process.execPath });
    await expect(transport.temporary(async root => { directory = root; return transport.run([file], root, '', timeout); })).rejects.toThrow(expected);
    expect(fs.existsSync(directory)).toBe(false);
  });

  it('cleans up a failed spawn without exposing executable diagnostics', async () => {
    const transport = createCliTransport('codex', { hostRequire: require, executable: path.join(os.tmpdir(), 'absent-agent-test-executable.exe') });
    let directory = '';
    await expect(transport.temporary(async root => { directory = root; return transport.run([], root, 'private prompt', 2000); })).rejects.toThrow('CLI unavailable');
    expect(fs.existsSync(directory)).toBe(false);
  });

  it('rejects an unowned temporary path before running or deleting anything', async () => {
    const remove = vi.fn(); const operation = vi.fn();
    const transport = createCliTransport('codex', { hostRequire: id => id === 'node:fs' ? { ...fs, mkdtempSync: () => path.dirname(os.tmpdir()), rmSync: remove } : require(id) });
    await expect(transport.temporary(operation)).rejects.toThrow('Invalid Agent temporary directory');
    expect(operation).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });

  it.each(['claude', 'codex'] as const)('runs the documented %s API with a disposable native fixture', async provider => {
    const file = script(`
      const args=process.argv.slice(2), provider=args.shift();
      if(args[0]==='--version') { console.log(provider==='claude'?'2.9.0 (Claude Code)':'codex-cli 0.999.0'); process.exit(0); }
      if(args.includes('stream-json')||args[0]==='app-server') {
        require('readline').createInterface({input:process.stdin}).on('line',line=>{
          const m=JSON.parse(line);
          if(provider==='claude') console.log(JSON.stringify({type:'control_response',response:{request_id:m.request_id,subtype:'success',response:{models:[{value:'default',displayName:'Fixture',supportsEffort:true,supportedEffortLevels:['low']}]}}}));
          else if(m.id) console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{}:{data:[{model:'fixture',displayName:'Fixture',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'low'}]}],nextCursor:null}}));
        });
      } else {
        let prompt=''; process.stdin.on('data',data=>prompt+=data); process.stdin.on('end',()=>console.log(JSON.stringify(provider==='claude'?{result:'Edited: '+prompt}:{type:'item.completed',item:{type:'agent_message',text:'Edited: '+prompt}})));
      }
    `);
    const calls: string[][] = []; const directories: string[] = [];
    const hostRequire = (id: string) => id === 'node:child_process' ? {
      spawn: (executable: string, args: string[], options: cp.SpawnOptions) => {
        expect(executable).toBe(process.execPath); expect(options.shell).toBe(false);
        calls.push(args); if (args[0] !== '--version') directories.push(String(options.cwd));
        return cp.spawn(executable, [file, provider, ...args], options);
      },
    } : require(id);
    const adapter = (provider === 'claude' ? createClaudeProvider : createCodexProvider)({ hostRequire, executable: process.execPath });
    expect(await adapter.available()).toBe(true);
    expect(await adapter.discover()).toMatchObject([{ label: 'Fixture', efforts: ['low'] }]);
    expect(await adapter.generate({ prompt: 'a plain document', model: 'fixture', effort: 'low' })).toBe('Edited: a plain document');
    expect(calls.filter(args => args[0] === '--version')).toHaveLength(3);
    expect(directories.every(directory => !fs.existsSync(directory))).toBe(true);
  });
});
