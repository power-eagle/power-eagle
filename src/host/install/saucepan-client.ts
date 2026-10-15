import { Client } from 'saucepan-sdk';
import type { Source, Selector, Evidence } from 'saucepan-sdk/models/source';
import type {
  Selection,
  ApplicationRegistration,
} from 'saucepan-sdk/models/claim';
import type { Policy } from 'saucepan-sdk/models/policy';
import type { GroupRecord } from 'saucepan-sdk/models/group';
import type { GroupPinRequest } from 'saucepan-sdk/models/pin';
import { resolveHostRequire } from './runtime-modules';

export interface PackageRequest {
  source: Source;
  selector: Selector;
  selection?: Selection;
  policyRefs?: string[];
  groupPolicyRefs?: string[];
}
export interface RetainedPackage {
  slot: string;
  sourceUuid: string;
  outputUuid: string;
  groupUuid: string;
  pinUuid: string;
  claimUuid?: string;
  scope?: string;
  directory: string;
  relative: string | null;
  source: Source;
  revision: Evidence;
  request: PackageRequest;
  persistence: 'persistent' | 'session';
}
interface Pending {
  slot: string;
  group: GroupRecord;
  pin: GroupPinRequest;
  request: PackageRequest;
  sourceUuid: string;
  persistence: 'persistent' | 'session';
  scope?: string;
}
interface State {
  format: 'power-eagle/saucepan';
  formatVersion: 1;
  app?: string;
  receipts: Record<string, RetainedPackage>;
  active: Record<string, string>;
  pending: Record<string, Pending>;
  readers: Record<string, string>;
  retiring: Record<string, boolean>;
}
export interface PowerEagleSaucepanOptions {
  client: Client;
  stateRoot: string;
  hostRequire?: NodeRequire;
  scope?: string;
  credentialFile?: string;
}
const PIN_POLICY = '9fc47d63-4387-4212-8e0f-9d75e100ac0a';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function stable(value: unknown): string {
  const ordered = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(ordered)
      : object(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, ordered(item[key])]),
          )
        : item;
  return JSON.stringify(ordered(value));
}

/** Consumer ownership and receipts. All resource semantics stay in the SDK/manager. */
export class PowerEagleSaucepan {
  readonly scope: string;
  readonly #require: NodeRequire;
  readonly #file: string;
  constructor(private readonly options: PowerEagleSaucepanOptions) {
    this.#require = resolveHostRequire(options.hostRequire);
    this.scope = options.scope ?? 'library';
    if (!this.scope.trim())
      throw new Error('An explicit installation scope is required');
    this.#file = (this.#require('path') as typeof import('node:path')).join(
      options.stateRoot,
      'saucepan.json',
    );
  }
  private fresh(): State {
    return {
      format: 'power-eagle/saucepan',
      formatVersion: 1,
      receipts: {},
      active: {},
      pending: {},
      readers: {},
      retiring: {},
    };
  }
  private read(): State {
    const fs = this.#require('fs') as typeof import('node:fs');
    const path = this.#require('path') as typeof import('node:path');
    if (fs.existsSync(path.join(this.options.stateRoot, '.saucepanhash')))
      throw new Error(
        'Old Saucepan token state is unsupported. Back up and remove the old Power Eagle token before registering with Saucepan 0.9. The shared store is not migrated.',
      );
    if (!fs.existsSync(this.#file)) return this.fresh();
    const state: unknown = JSON.parse(fs.readFileSync(this.#file, 'utf8'));
    if (
      !object(state) ||
      state.format !== 'power-eagle/saucepan' ||
      state.formatVersion !== 1 ||
      !object(state.receipts) ||
      !object(state.active) ||
      !object(state.pending) ||
      !object(state.readers) ||
      !object(state.retiring) ||
      (state.app !== undefined && !uuid(state.app))
    )
      throw new Error(
        'Invalid Power Eagle Saucepan receipt state; inspect it before recovery',
      );
    for (const [key, value] of Object.entries(state.receipts))
      if (
        !object(value) ||
        !uuid(key) ||
        value.pinUuid !== key ||
        !uuid(value.outputUuid) ||
        !uuid(value.groupUuid) ||
        typeof value.directory !== 'string' ||
        typeof value.slot !== 'string' ||
        !object(value.request)
      )
        throw new Error('Invalid retained package receipt');
    for (const pin of Object.values(state.active))
      if (typeof pin !== 'string' || !(pin in state.receipts))
        throw new Error('Invalid active package receipt');
    for (const [reader, pin] of Object.entries(state.readers))
      if (!uuid(reader) || typeof pin !== 'string' || !(pin in state.receipts))
        throw new Error('Invalid durable reader receipt');
    for (const [pin, retiring] of Object.entries(state.retiring))
      if (!(pin in state.receipts) || retiring !== true)
        throw new Error('Invalid retiring package receipt');
    return state as unknown as State;
  }
  private save(state: State): void {
    const fs = this.#require('fs') as typeof import('node:fs');
    const temporary = `${this.#file}.${this.id()}.tmp`;
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(state, null, 2) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.renameSync(temporary, this.#file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  private async transaction<T>(run: (state: State) => Promise<T>): Promise<T> {
    const fs = this.#require('fs') as typeof import('node:fs');
    fs.mkdirSync(this.options.stateRoot, { recursive: true });
    const lock = `${this.#file}.lock`;
    let fd: number;
    try {
      fd = fs.openSync(lock, 'wx', 0o600);
    } catch {
      throw new Error(
        `Power Eagle resource state is busy. If a previous process crashed, inspect ${lock} before removing its lock.`,
      );
    }
    try {
      fs.writeFileSync(
        fd,
        String((this.#require('process') as typeof import('node:process')).pid),
      );
      return await run(this.read());
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
  private id(): string {
    return (
      this.#require('crypto') as typeof import('node:crypto')
    ).randomUUID();
  }
  private bound(state: State): Client {
    if (!state.app)
      throw new Error('Register Power Eagle before persistent acquisition');
    return this.options.client.forApp(state.app, {
      credentialFile: this.options.credentialFile,
    });
  }
  initializeStore() {
    return this.options.client.init();
  }
  async ensureRegistration(
    options: Omit<ApplicationRegistration, 'registration_key' | 'name'> & {
      credentialOut?: string;
    } = {},
  ): Promise<string> {
    return this.transaction(async (state) => {
      if (state.app) return state.app;
      const { credentialOut, ...registration } = options;
      const app = await this.options.client.registerApplication(
        {
          registration_key: 'power-eagle',
          name: 'Power Eagle',
          ...registration,
        },
        { credentialOut },
      );
      state.app = app.uuid;
      this.save(state);
      return app.uuid;
    });
  }
  registerPolicies(policies: Policy[]) {
    return this.options.client.registerPolicies(policies);
  }
  async adoptPolicies(expectedRevision: number, policyRefs: string[]) {
    return this.transaction(async (state) =>
      this.options.client.adoptAppPolicies(
        state.app!,
        expectedRevision,
        policyRefs,
      ),
    );
  }
  acquirePersistent(request: PackageRequest) {
    return this.acquire(request, 'persistent');
  }
  acquireSession(request: PackageRequest) {
    return this.acquire(request, 'session');
  }
  private async acquire(
    request: PackageRequest,
    persistence: 'persistent' | 'session',
  ): Promise<RetainedPackage> {
    return this.transaction(async (state) => {
      const client =
        persistence === 'persistent' ? this.bound(state) : this.options.client;
      // Explicit local setup is separate from the bound acquisition; denials never fall back.
      const source = await this.options.client.registerSource(request.source);
      const hash = (this.#require('crypto') as typeof import('node:crypto'))
        .createHash('sha256')
        .update(
          stable([
            source.uuid,
            request.selector,
            request.selection ?? {},
            request.policyRefs ?? [],
            request.groupPolicyRefs ?? [],
          ]),
        )
        .digest('hex');
      const slot = `${persistence}/${persistence === 'persistent' ? this.scope : 'preview'}/${hash}`;
      let pending = state.pending[slot];
      if (!pending) {
        await this.options.client.registerPolicies([
          { uuid: PIN_POLICY, type: 'pin_policy', retention: 'until_released' },
        ]);
        const group = await client.registerGroup({
          registration_key: `power-eagle/${slot}`,
          policy_refs: request.groupPolicyRefs ?? [],
          members: [
            {
              name: 'package',
              target: {
                type: 'acquire',
                source_uuid: source.uuid,
                selector: request.selector,
                ...(request.selection ? { selection: request.selection } : {}),
                policy_refs: request.policyRefs ?? [],
                ...(persistence === 'persistent'
                  ? { claim: { scope: this.scope } }
                  : {}),
              },
            },
          ],
        });
        pending = {
          slot,
          group,
          pin: {
            registration_key: `power-eagle/${this.id()}`,
            policy_refs: [PIN_POLICY],
          },
          request,
          sourceUuid: source.uuid,
          persistence,
          ...(persistence === 'persistent' ? { scope: this.scope } : {}),
        };
        state.pending[slot] = pending;
        this.save(state);
      }
      // The exact request survives a lost response or process restart. Never invent a new key on retry.
      const prepared = await client.prepareGroup(pending.group.uuid, {
        expectedRevision: pending.group.revision,
        pin: pending.pin,
      });
      const member = prepared.resources.members.package;
      if (
        !prepared.pin ||
        prepared.pin.state !== 'active' ||
        !member ||
        !prepared.pin.request.outputs.includes(member.output_uuid)
      )
        throw new Error(
          'Preparation did not return retention over the selected package',
        );
      const receipt: RetainedPackage = {
        slot,
        sourceUuid: source.uuid,
        outputUuid: member.output_uuid,
        groupUuid: prepared.group.uuid,
        pinUuid: prepared.pin.uuid,
        ...(member.claim_uuid ? { claimUuid: member.claim_uuid } : {}),
        ...(pending.scope ? { scope: pending.scope } : {}),
        directory: member.directory,
        relative: member.relative,
        source: request.source,
        revision:
          prepared.group.selected?.members.package.selected_source ?? {},
        request,
        persistence,
      };
      state.receipts[receipt.pinUuid] = receipt;
      delete state.pending[slot];
      this.save(state);
      return receipt;
    });
  }
  async publish(receipt: RetainedPackage): Promise<void> {
    await this.transaction(async (state) => {
      this.owned(state, receipt);
      await this.verifyReceipt(state, receipt);
      if (receipt.persistence === 'persistent') {
        state.active[receipt.slot] = receipt.pinUuid;
        this.save(state);
      }
    });
  }
  private owned(state: State, receipt: RetainedPackage) {
    if (stable(state.receipts[receipt.pinUuid]) !== stable(receipt))
      throw new Error('Retention is not an owned Power Eagle receipt');
  }
  async retainedPackages(): Promise<RetainedPackage[]> {
    const state = this.read();
    const result: RetainedPackage[] = [];
    for (const pinUuid of Object.values(state.active)) {
      const receipt = state.receipts[pinUuid];
      if (receipt.scope !== this.scope) continue;
      result.push(await this.verifyReceipt(state, receipt));
    }
    return result;
  }
  private async verifyReceipt(
    state: State,
    receipt: RetainedPackage,
  ): Promise<RetainedPackage> {
    const client =
      receipt.persistence === 'persistent'
        ? this.bound(state)
        : this.options.client;
    const pin = await client.pin(receipt.pinUuid);
    const group = pin.group?.group;
    const member = group?.selected?.members.package;
    const target = group?.definition.members.find(
      (item) => item.name === 'package',
    )?.target;
    const output = pin.outputs[receipt.outputUuid];
    const owner = receipt.persistence === 'persistent' ? state.app : null;
    if (
      pin.state !== 'active' ||
      pin.owner !== owner ||
      group?.owner !== owner ||
      group.uuid !== receipt.groupUuid ||
      !member ||
      member.output_uuid !== receipt.outputUuid ||
      member.claim_uuid !== (receipt.claimUuid ?? null) ||
      member.scope !== (receipt.scope ?? null) ||
      target?.type !== 'acquire' ||
      target.source_uuid !== receipt.sourceUuid ||
      stable(target.selector) !== stable(receipt.request.selector) ||
      !output?.available ||
      !pin.request.outputs.includes(receipt.outputUuid) ||
      stable(member.selected_source) !== stable(receipt.revision)
    )
      throw new Error(
        `Retained package receipt does not match its authenticated pin: ${receipt.pinUuid}`,
      );
    const path = this.#require('path') as typeof import('node:path');
    const directory = member.relative
      ? path.resolve(output.path, member.relative)
      : output.path;
    const relative = path.relative(output.path, directory);
    if (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw new Error('Retained path escapes its selected output');
    if (path.resolve(directory) !== path.resolve(receipt.directory))
      throw new Error(
        'Saved package directory differs from the retained manager path; inspect the receipt before activation',
      );
    return { ...receipt, directory, relative: member.relative };
  }
  async forget(receipt: RetainedPackage): Promise<void> {
    await this.transaction(async (state) => {
      this.owned(state, receipt);
      if (state.active[receipt.slot] === receipt.pinUuid) {
        delete state.active[receipt.slot];
        this.save(state);
      }
    });
  }
  /** Call only after provider disposal and all copies/readers finish. */
  async release(receipt: RetainedPackage): Promise<void> {
    await this.transaction(async (state) => this.releaseOwned(state, receipt));
  }
  private async releaseOwned(
    state: State,
    receipt: RetainedPackage,
  ): Promise<void> {
    this.owned(state, receipt);
    if (state.active[receipt.slot] === receipt.pinUuid)
      throw new Error(
        'Uninstall or replace the active package before releasing retention',
      );
    if (Object.values(state.readers).includes(receipt.pinUuid)) {
      state.retiring[receipt.pinUuid] = true;
      this.save(state);
      return;
    }
    const client =
      receipt.persistence === 'persistent'
        ? this.bound(state)
        : this.options.client;
    await client.unpin(receipt.pinUuid);
    const others = Object.values(state.receipts).filter(
      (item) => item.pinUuid !== receipt.pinUuid,
    );
    // A pending generation remains inspectable; never remove intent it may still need.
    if (
      !Object.values(state.pending).some(
        (item) => item.group.uuid === receipt.groupUuid,
      ) &&
      !others.some((item) => item.groupUuid === receipt.groupUuid)
    ) {
      const groups = await client.listGroups({
        key: `power-eagle/${receipt.slot}`,
      });
      const group = groups.find((item) => item.uuid === receipt.groupUuid);
      if (group) await client.removeGroup(group.uuid, group.revision);
    }
    if (
      receipt.claimUuid &&
      state.app &&
      Object.keys(state.pending).length === 0 &&
      !others.some((item) => item.claimUuid === receipt.claimUuid)
    ) {
      const claims = await client.claims(state.app);
      if (claims.some((item) => item.claim.uuid === receipt.claimUuid))
        await client.releaseClaim(state.app, receipt.claimUuid);
    }
    delete state.receipts[receipt.pinUuid];
    delete state.retiring[receipt.pinUuid];
    this.save(state);
  }
  retainedReceipts(): RetainedPackage[] {
    return Object.values(this.read().receipts);
  }
  /** Durable reader markers coordinate windows and conservatively survive crashes. */
  async retainReader(
    receipt: RetainedPackage,
  ): Promise<{ directory: string; close: () => Promise<void> }> {
    const readerId = this.id();
    const verified = await this.transaction(async (state) => {
      this.owned(state, receipt);
      if (state.retiring[receipt.pinUuid])
        throw new Error('Package is closing');
      const verified = await this.verifyReceipt(state, receipt);
      state.readers[readerId] = receipt.pinUuid;
      this.save(state);
      return verified;
    });
    let closed = false;
    return {
      directory: verified.directory,
      close: async () => {
        if (closed) return;
        await this.transaction(async (state) => {
          delete state.readers[readerId];
          this.save(state);
          if (state.retiring[receipt.pinUuid])
            await this.releaseOwned(state, receipt);
        });
        closed = true;
      },
    };
  }
}
