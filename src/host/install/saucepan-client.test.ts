import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Client, TransportError, type Call, type Config } from 'saucepan-sdk';
import { EagleTransport } from './saucepan-transport';
import { PowerEagleSaucepan, type PackageRequest } from './saucepan-client';
const require = createRequire(import.meta.url);
const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);
const executable =
  process.env.POWER_EAGLE_TEST_SAUCEPAN ??
  resolve('../saucepan-2/target/debug/saucepan.exe');
function integrationIt(
  name: string,
  run: () => Promise<void>,
  timeout = 30000,
) {
  it(name, run, timeout);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-sdk-integration-'));
  roots.push(root);
  const source = join(root, 'source');
  mkdirSync(join(source, 'package'), { recursive: true });
  writeFileSync(join(source, 'package', 'hello.txt'), 'original');
  const client = new Client({
    executable,
    root: join(root, 'manager'),
    transport: new EagleTransport(require),
  });
  const options = {
    client,
    stateRoot: join(root, 'state'),
    hostRequire: require,
  };
  return {
    root,
    source,
    client,
    options,
    app: new PowerEagleSaucepan(options),
    request: {
      source: { type: 'local', path: source },
      selector: { type: 'local' },
      selection: { folder: 'package' },
    } as PackageRequest,
  };
}
describe.skipIf(!existsSync(executable))(
  'current manager ownership integration',
  () => {
    integrationIt(
      'reuses scoped claims, retains exact copied outputs and restores published receipts',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        const app = await f.app.ensureRegistration();
        const verification = randomUUID();
        await f.app.registerPolicies([
          {
            uuid: verification,
            type: 'verification_policy',
            policy_target: 'path',
            mode: 'full',
          },
        ]);
        f.request.groupPolicyRefs = [verification];
        expect(await f.app.ensureRegistration()).toBe(app);
        const a = await f.app.acquirePersistent(f.request);
        await f.app.publish(a);
        const b = await f.app.acquirePersistent(f.request);
        expect(b.claimUuid).toBe(a.claimUuid);
        expect(b.pinUuid).not.toBe(a.pinUuid);
        expect(readFileSync(join(a.directory, 'hello.txt'), 'utf8')).toBe(
          'original',
        );
        expect(
          await new PowerEagleSaucepan(f.options).retainedPackages(),
        ).toEqual([a]);
        expect((await f.client.querySources()).sources).toEqual([]);
        const other = new PowerEagleSaucepan({
          ...f.options,
          scope: 'another-project',
        });
        const c = await other.acquirePersistent(f.request);
        expect(c.claimUuid).not.toBe(a.claimUuid);
        const preview = await f.app.acquireSession(f.request);
        expect(preview.claimUuid).toBeUndefined();
        expect(await f.client.forApp(app).claims(app)).toHaveLength(2);
        await f.app.release(preview);
        expect((await f.client.pin(preview.pinUuid)).state).toBe('released');
      },
    );
    integrationIt(
      'reconciles a lost preparation response with its original pin key after restart',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        await f.app.ensureRegistration();
        let lost = true;
        class LoseOnce extends EagleTransport {
          override async json(config: Config, call: Call) {
            const result = await super.json(config, call);
            if (call.argv[0] === 'prepare-group' && lost) {
              lost = false;
              throw new TransportError('protocol', true, true);
            }
            return result;
          }
        }
        const client = new Client({
          executable,
          root: join(f.root, 'manager'),
          transport: new LoseOnce(require),
        });
        await expect(
          new PowerEagleSaucepan({ ...f.options, client }).acquirePersistent(
            f.request,
          ),
        ).rejects.toMatchObject({ indeterminate: true });
        const a = await new PowerEagleSaucepan(f.options).acquirePersistent(
          f.request,
        );
        expect(a.pinUuid).toBeTruthy();
        const app = await f.app.ensureRegistration();
        expect(await f.client.forApp(app).pins()).toHaveLength(1);
      },
    );
    integrationIt(
      'fails closed on old marker and corrupt app receipt state',
      async () => {
        const f = fixture();
        mkdirSync(f.options.stateRoot, { recursive: true });
        writeFileSync(join(f.options.stateRoot, '.saucepanhash'), '{}');
        await expect(f.app.ensureRegistration()).rejects.toThrow(
          'Old Saucepan token',
        );
        rmSync(join(f.options.stateRoot, '.saucepanhash'));
        writeFileSync(join(f.options.stateRoot, 'saucepan.json'), '{}');
        await expect(f.app.ensureRegistration()).rejects.toThrow(
          'Invalid Power Eagle',
        );
      },
    );
    integrationIt(
      'preserves exact Git commits and URL ZIP/raw selections through real acquisition',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        await f.app.ensureRegistration();
        const git = (...args: string[]) =>
          execFileSync('git', ['-C', f.source, ...args], {
            encoding: 'utf8',
          }).trim();
        git('init', '-b', 'main');
        git('add', '.');
        git(
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '-m',
          'fixture',
        );
        const commit = git('rev-parse', 'HEAD');
        const fixed = await f.app.acquirePersistent({
          source: { type: 'git', origin: f.source },
          selector: { type: 'commit', commit },
          selection: { folder: 'package' },
        });
        expect(readFileSync(join(fixed.directory, 'hello.txt'), 'utf8')).toBe(
          'original',
        );
        expect(JSON.stringify(fixed.revision)).toContain(commit);
        const zip = Buffer.from(
          'UEsDBBQAAAAAAIFLT1112oQwCwAAAAsAAAARAAAAcGFja2FnZS9oZWxsby50eHR6aXAgY29udGVudFBLAQIUABQAAAAAAIFLT1112oQwCwAAAAsAAAARAAAAAAAAAAAAAACAAQAAAABwYWNrYWdlL2hlbGxvLnR4dFBLBQYAAAAAAQABAD8AAAA6AAAAAAA=',
          'base64',
        );
        const server = createServer((req, res) => {
          res.end(req.url === '/bundle.zip' ? zip : Buffer.from('raw content'));
        });
        await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
        try {
          const address = server.address() as { port: number };
          const base = `http://127.0.0.1:${address.port}`;
          const zipped = await f.app.acquireSession({
            source: { type: 'url', url: base + '/bundle.zip' },
            selector: { type: 'url' },
            selection: { format: 'zip', folder: 'package' },
          });
          expect(
            readFileSync(join(zipped.directory, 'hello.txt'), 'utf8'),
          ).toBe('zip content');
          const raw = await f.app.acquireSession({
            source: { type: 'url', url: base + '/plain' },
            selector: { type: 'url' },
            selection: { format: 'raw', filename: 'download.txt' },
          });
          expect(
            readFileSync(join(raw.directory, 'download.txt'), 'utf8'),
          ).toBe('raw content');
        } finally {
          await new Promise<void>((done, reject) =>
            server.close((error) => (error ? reject(error) : done())),
          );
        }
      },
    );
    integrationIt(
      'explicitly adopts immutable policy IDs and never falls back from scoped denial',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        const app = await f.app.ensureRegistration();
        const a = randomUUID(),
          b = randomUUID();
        await f.app.registerPolicies([
          { uuid: a, type: 'access_policy', scopes: ['library'] },
          { uuid: b, type: 'access_policy', scopes: ['another-project'] },
        ]);
        await f.app.adoptPolicies(0, [a]);
        const ok = await f.app.acquirePersistent(f.request);
        expect(ok.claimUuid).toBeTruthy();
        await f.app.adoptPolicies((await f.client.inspect(app)).revision!, [b]);
        await expect(f.app.acquirePersistent(f.request)).rejects.toMatchObject({
          code: 'access_denied',
        });
        expect(
          (await f.client.pins()).filter((pin) => pin.owner === null),
        ).toHaveLength(0);
        expect(app).toBeTruthy();
      },
    );
    integrationIt(
      'refreshes a tracked Git subpath while pins preserve prior generations through reclaim',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        await f.app.ensureRegistration();
        const git = (...args: string[]) =>
          execFileSync('git', ['-C', f.source, ...args], {
            encoding: 'utf8',
          }).trim();
        git('init', '-b', 'main');
        git('add', '.');
        git(
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '-m',
          'first',
        );
        const refs = [randomUUID(), randomUUID(), randomUUID()];
        await f.app.registerPolicies([
          { uuid: refs[0], type: 'refresh_policy', mode: 'always' },
          { uuid: refs[1], type: 'update_policy', mode: 'always' },
          { uuid: refs[2], type: 'revision_policy', history: 'none' },
        ]);
        const request: PackageRequest = {
          source: { type: 'git', origin: f.source },
          selector: { type: 'ref', reference: 'main' },
          selection: { folder: 'package' },
          policyRefs: refs,
        };
        const a = await f.app.acquirePersistent(request);
        await f.app.publish(a);
        writeFileSync(join(f.source, 'package', 'hello.txt'), 'changed');
        git('add', '.');
        git(
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '-m',
          'second',
        );
        const b = await f.app.acquirePersistent(request);
        await f.app.publish(b);
        expect(b.outputUuid).not.toBe(a.outputUuid);
        expect(b.claimUuid).toBe(a.claimUuid);
        await f.client.reclaim();
        expect(readFileSync(join(a.directory, 'hello.txt'), 'utf8')).toBe(
          'original',
        );
        expect(readFileSync(join(b.directory, 'hello.txt'), 'utf8')).toBe(
          'changed',
        );
        const otherWindow = new PowerEagleSaucepan(f.options);
        const reader = await otherWindow.retainReader(a);
        await f.app.release(a);
        await f.client.reclaim();
        expect(readFileSync(join(reader.directory, 'hello.txt'), 'utf8')).toBe(
          'original',
        );
        await reader.close();
        await f.client.reclaim();
        expect((await f.client.pin(b.pinUuid)).state).toBe('active');
      },
      30000,
    );
    integrationIt(
      'rejects edited cached paths instead of loading unrelated content',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        await f.app.ensureRegistration();
        const receipt = await f.app.acquirePersistent(f.request);
        await f.app.publish(receipt);
        const file = join(f.options.stateRoot, 'saucepan.json');
        const state = JSON.parse(readFileSync(file, 'utf8'));
        state.receipts[receipt.pinUuid].directory = f.source;
        writeFileSync(file, JSON.stringify(state));
        await expect(f.app.retainedPackages()).rejects.toThrow(
          'differs from the retained manager path',
        );
      },
    );
    integrationIt(
      'supports explicitly protected credentials and cleans up only the final owned installation',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        const credentialFile = join(f.root, 'credential.json');
        const app = await f.app.ensureRegistration({
          credentials_required: true,
          credentialOut: credentialFile,
        });
        await expect(f.app.acquirePersistent(f.request)).rejects.toMatchObject({
          code: 'authentication_required',
        });
        const protectedApp = new PowerEagleSaucepan({
          ...f.options,
          credentialFile,
        });
        const receipt = await protectedApp.acquirePersistent(f.request);
        await protectedApp.publish(receipt);
        await protectedApp.forget(receipt);
        await protectedApp.release(receipt);
        const bound = f.client.forApp(app, { credentialFile });
        expect(await bound.claims(app)).toEqual([]);
        expect(await bound.listGroups()).toEqual([]);
        expect((await bound.pin(receipt.pinUuid)).state).toBe('released');
      },
    );
    integrationIt(
      'preserves a conflicting preparation identity instead of minting a replacement generation',
      async () => {
        const f = fixture();
        await f.app.initializeStore();
        const appId = await f.app.ensureRegistration();
        const original = await f.app.acquirePersistent(f.request);
        await f.app.publish(original);
        let conflict = true;
        class ConflictOnce extends EagleTransport {
          override async json(config: Config, call: Call) {
            if (call.argv[0] === 'prepare-group' && conflict) {
              conflict = false;
              const bound = f.client.forApp(appId);
              const group = await bound.showGroup(String(call.argv[1]));
              await bound.replaceGroup(
                group.uuid,
                {
                  ...group.definition,
                  members: group.definition.members.map((member) => ({
                    ...member,
                    name: 'changed',
                  })),
                },
                group.revision,
              );
            }
            return super.json(config, call);
          }
        }
        const client = new Client({
          executable,
          root: join(f.root, 'manager'),
          transport: new ConflictOnce(require),
        });
        const conflicting = new PowerEagleSaucepan({ ...f.options, client });
        await expect(
          conflicting.acquirePersistent(f.request),
        ).rejects.toMatchObject({ code: 'revision_conflict' });
        const file = join(f.options.stateRoot, 'saucepan.json');
        const before = JSON.parse(readFileSync(file, 'utf8')).pending;
        await expect(
          conflicting.acquirePersistent(f.request),
        ).rejects.toMatchObject({ code: 'revision_conflict' });
        expect(JSON.parse(readFileSync(file, 'utf8')).pending).toEqual(before);
        expect(await f.app.retainedPackages()).toEqual([original]);
      },
    );
  },
);
