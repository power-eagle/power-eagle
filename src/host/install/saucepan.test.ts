import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { Client, Payload, SaucepanError, type Config } from 'saucepan-sdk';
import { EagleTransport } from './saucepan-transport';
import { initializeSaucepan } from './saucepan-manager';
const require = createRequire(import.meta.url);
const roots: string[] = [];
afterEach(() => {
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function host(script: string): NodeRequire {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-sdk-test-'));
  roots.push(root);
  const fixture = join(root, 'fixture.cjs');
  writeFileSync(fixture, script);
  return ((name: string) =>
    name === 'child_process'
      ? {
          spawn: (_exe: string, argv: string[], options: object) =>
            spawn(process.execPath, [fixture, ...argv], options),
          execFile: (
            _exe: string,
            argv: string[],
            options: object,
            cb: unknown,
          ) =>
            (execFile as Function)(
              process.execPath,
              [fixture, ...argv],
              options,
              cb,
            ),
        }
      : require(name)) as NodeRequire;
}
const config: Config = {
  executable: 'fixture',
  timeout: 1000,
  captureLimit: 10000,
  inputLimit: 1000,
};
describe('Eagle SDK transport', () => {
  it('passes literal context and closed payloads, then removes payload files', async () => {
    const transport = new EagleTransport(
      host(
        `const fs=require('fs'); const argv=process.argv.slice(2); console.log(JSON.stringify({argv,payload:JSON.parse(fs.readFileSync(argv.at(-1),'utf8'))}));`,
      ),
    );
    const value = (await transport.json(
      {
        ...config,
        root: 'root with spaces',
        app: 'app',
        credentialFile: 'secret path',
      },
      { argv: ['op', new Payload({ literal: '$(no shell)' })], mutates: true },
    )) as { argv: string[]; payload: unknown };
    expect(value.argv.slice(0, 8)).toEqual([
      '--error-format',
      'json',
      '--root',
      'root with spaces',
      '--as-app',
      'app',
      '--credential-file',
      'secret path',
    ]);
    expect(value.payload).toEqual({ literal: '$(no shell)' });
    expect(existsSync(value.argv[value.argv.length - 1])).toBe(false);
  });
  it('uses the public client with the injected transport', async () => {
    const client = new Client({
      transport: new EagleTransport(
        host(`console.log(JSON.stringify({generation:1,sources:[]}))`),
      ),
    });
    expect(await client.querySources()).toEqual({ generation: 1, sources: [] });
  });
  it('accepts profile-name arrays and rejects malformed profile and explanation shapes', async () => {
    const names = ['managed', 'explicit-update', 'temporary'];
    const client = new Client({
      transport: new EagleTransport(host(`console.log('${JSON.stringify(names)}')`)),
    });
    expect(await client.profiles()).toEqual(names);
    const profile = {
      name: 'managed', digest: 'digest', catalog: [], for_install: false,
      retrieval_policy_refs: [], acquisition_policy_refs: [], combined_policy_refs: [],
    };
    for (const [key, wrong] of Object.entries({
      name: 1, digest: false, catalog: {}, for_install: 'false',
      retrieval_policy_refs: {}, acquisition_policy_refs: null, combined_policy_refs: '',
    })) {
      const malformed = new Client({ transport: new EagleTransport(host(
        `console.log('${JSON.stringify({ ...profile, [key]: wrong })}')`,
      )) });
      await expect(malformed.profile()).rejects.toMatchObject({ kind: 'protocol', indeterminate: false });
    }
    for (const response of [{ axes: [], restrictions: [] }, { axes: {}, restrictions: {} }]) {
      const malformed = new Client({ transport: new EagleTransport(host(
        `console.log('${JSON.stringify(response)}')`,
      )) });
      await expect(malformed.explainPolicies({
        operation: 'retrieve', request: { source: { kind: 'inline', source: { type: 'local', path: 'fixture' } }, selector: { type: 'local' } },
      })).rejects.toMatchObject({ kind: 'protocol', indeterminate: false });
    }
  });
  it('preserves structured errors without marking a known denial uncertain', async () => {
    const transport = new EagleTransport(
      host(
        `console.error(JSON.stringify({error:{code:'denied',message:'not allowed',details:{action:'read'}}}));process.exitCode=1;`,
      ),
    );
    await expect(
      transport.json(config, { argv: ['op'], mutates: true }),
    ).rejects.toBeInstanceOf(SaucepanError);
  });
  it('marks invalid responses and timeouts of mutations indeterminate', async () => {
    await expect(
      new EagleTransport(host(`console.log('broken')`)).json(config, {
        argv: ['op'],
        mutates: true,
      }),
    ).rejects.toMatchObject({ kind: 'protocol', indeterminate: true });
    await expect(
      new EagleTransport(host(`setInterval(()=>{},1000)`)).json(
        { ...config, timeout: 50 },
        { argv: ['op'], mutates: true },
      ),
    ).rejects.toMatchObject({ kind: 'timeout', indeterminate: true });
  });
  it('bounds input before launch and captured bytes after launch', async () => {
    const transport = new EagleTransport(
      host(`process.stdout.write('x'.repeat(20000))`),
    );
    await expect(
      transport.json(config, {
        argv: [new Payload('x'.repeat(2000))],
        mutates: true,
      }),
    ).rejects.toMatchObject({ kind: 'input_limit', indeterminate: false });
    await expect(
      transport.json(config, { argv: ['op'], mutates: true }),
    ).rejects.toMatchObject({ kind: 'output_limit', indeterminate: true });
  });
  it('rejects lossy payload numbers, batch executables and wrong response types', async () => {
    const transport = new EagleTransport(
      host(`console.log('{"generation":"one","sources":[]}')`),
    );
    for (const value of [
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      new Date(),
      undefined,
    ]) {
      await expect(
        transport.json(config, { argv: [new Payload(value)], mutates: true }),
      ).rejects.toMatchObject({ kind: 'invalid_input', indeterminate: false });
    }
    await expect(
      transport.json(config, {
        argv: ['op'],
        required: ['generation', 'sources'],
        mutates: true,
      }),
    ).rejects.toMatchObject({ kind: 'protocol', indeterminate: true });
    if (process.platform === 'win32')
      await expect(
        transport.run(
          { ...config, executable: 'unsafe.cmd' },
          { argv: ['run'] },
          {},
        ),
      ).rejects.toMatchObject({ kind: 'invalid_executable' });
  });
  it('bounds deadlines even when a child ignores graceful termination', async () => {
    const transport = new EagleTransport(
      host(`process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`),
    );
    const start = Date.now();
    await expect(
      transport.run(
        config,
        { argv: ['run'], mutates: true },
        { timeout: 100, capture: true },
      ),
    ).rejects.toMatchObject({ kind: 'timeout', indeterminate: true });
    expect(Date.now() - start).toBeLessThan(3000);
  });
  it('preserves binary run output and supports cancellation', async () => {
    const transport = new EagleTransport(
      host(`process.stdout.write(Buffer.from([0,255,128]))`),
    );
    const result = await transport.run(
      config,
      { argv: ['run'] },
      { capture: true },
    );
    expect([...result.stdout!]).toEqual([0, 255, 128]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      transport.run(
        config,
        { argv: ['run'], mutates: true },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ kind: 'cancelled', indeterminate: false });
  });
});
describe('read-only manager probe', () => {
  it('handles browser preview and missing executables', async () => {
    expect((await initializeSaucepan()).status).toBe('unavailable');
    expect(
      await initializeSaucepan({
        hostRequire: require,
        binaryPath: 'missing-saucepan',
      }),
    ).toMatchObject({ status: 'unavailable', builtInsAvailable: true });
  });
  it('accepts build suffixes and only version/help calls', async () => {
    const hostRequire = host(
      `const arg=process.argv[2];if(arg==='--version')console.log('saucepan 0.10.0+dev');else if(arg==='--help')console.log('register-application register-source register-group prepare-group pin unpin profiles profile explain-policies');else process.exit(99);`,
    );
    expect(
      await initializeSaucepan({ hostRequire, binaryPath: 'fixture' }),
    ).toMatchObject({ status: 'ready', version: 'saucepan 0.10.0+dev' });
  });
  it('rejects pre-profile managers and incomplete 0.10 command surfaces', async () => {
    for (const version of ['0.9.0', '0.10.0']) {
      const hostRequire = host(`if(process.argv[2]==='--version')console.log('saucepan ${version}');else console.log('register-application register-source register-group prepare-group pin unpin');`);
      expect(await initializeSaucepan({ hostRequire, binaryPath: 'fixture' }))
        .toMatchObject({ status: 'unavailable', builtInsAvailable: true });
    }
  });
  it('rejects old protocols before any mutation', async () => {
    const hostRequire = host(`console.log('saucepan 0.6.0')`);
    expect(
      await initializeSaucepan({ hostRequire, binaryPath: 'fixture' }),
    ).toMatchObject({ status: 'unavailable' });
  });
});
