// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import clipboardRuntime from '../../examples/clipboard-runtime/document';
import clipboardManifestInput from '../../examples/clipboard-runtime/manifest.json';
import { ActivationController, RevokedServiceHandleError, contributionRegistrations } from '../host/activation/controller';
import { buildExportRegistryGraph } from '../host/activation/dependency-graph';
import { EnablementPreferences, reconcileEnablement, type EnablementPersistence } from '../host/activation/enablement';
import { createEagleCapabilities } from '../host/eagle-capabilities';
import type { DiscoveredPackage } from '../host/install/contribution-package';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { ActivationScope } from '../sdui/runtime/lifecycle';
import { RuntimeSession, type RuntimeCatalog } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { unwrap, validatePackage } from '../sdui/schema/validate';
import type { Json } from '../sdui/schema/model';
import { CLIPBOARD_IDENTITY, clipboardServicePackage } from './clipboard-service';

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const sessions: RuntimeSession[] = [];
const controllers: ActivationController[] = [];

afterEach(async () => {
  cleanup();
  for (const session of sessions.splice(0)) await session.dispose();
  for (const controller of controllers.splice(0)) await controller.dispose();
});

describe('clipboard package contract', () => {
  it('activates a runtime consumer after the built-in service and calls the real Eagle boundary', async () => {
    let clipboardText = 'From Eagle';
    const writeText = vi.fn((text: string) => { clipboardText = text; });
    const capabilities = createEagleCapabilities({
      host: { clipboard: { readText: () => clipboardText, writeText } },
    });
    const provider = clipboardServicePackage(capabilities);
    const manifest = unwrap(validatePackage(clipboardManifestInput));
    const consumer: DiscoveredPackage = {
      root: 'example:clipboard-runtime', manifestPath: 'example:clipboard-runtime/manifest.json', manifest,
      entries: { runtime: 'example:clipboard-runtime/run.json' }, assets: {}, runtime: clipboardRuntime,
    };
    const graph = buildExportRegistryGraph([consumer, provider.discovered]);
    const preferences = EnablementPreferences.open(new MemoryPersistence());
    const effective = reconcileEnablement(graph, preferences);
    expect([...effective.active.keys()]).toEqual([CLIPBOARD_IDENTITY, 'example.clipboard-runtime/main']);

    const controller = new ActivationController();
    controllers.push(controller);
    const activation = await controller.reconcile(effective, [
      provider.registration, ...contributionRegistrations(consumer, []),
    ]);
    expect(activation.failures.size).toBe(0);
    expect(activation.snapshot.service.has(CLIPBOARD_IDENTITY)).toBe(true);
    expect(activation.snapshot.runtime.has('example.clipboard-runtime/main')).toBe(true);

    const descriptor = provider.discovered.manifest.exports.find(item => item.kind === 'service')!;
    const catalog: RuntimeCatalog = {
      ...foundationRuntimeCatalog,
      exports: { [CLIPBOARD_IDENTITY]: { version: provider.discovered.manifest.version, descriptor } },
    };
    const service = controller.service(CLIPBOARD_IDENTITY);
    const session = new RuntimeSession(clipboardRuntime, catalog, {
      calls: {
        [CLIPBOARD_IDENTITY]: {
          input: { type: 'json' }, output: { type: 'json' },
          invoke: (args: Json, context) => service.invoke(context.method!, args, context),
        },
      },
    });
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    const input = screen.getByRole('textbox', { name: 'Text' });
    await user.clear(input);
    await user.type(input, 'Package contract');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Package contract'));
    expect(screen.getByText('Copied through the clipboard service.')).toBeTruthy();

    clipboardText = 'Read from Eagle';
    await user.click(screen.getByRole('button', { name: 'Paste' }));
    expect(await screen.findByText('Read: Read from Eagle')).toBeTruthy();

    preferences.setPackage(provider.discovered.manifest.id, false);
    await controller.reconcile(reconcileEnablement(graph, preferences), [
      provider.registration, ...contributionRegistrations(consumer, []),
    ]);
    expect(controller.snapshot.runtime.has('example.clipboard-runtime/main')).toBe(false);
    const scope = new ActivationScope('revoked-clipboard-call');
    await expect(service.invoke('read', null, {
      signal: scope.signal, use: disposer => scope.use(disposer),
    })).rejects.toBeInstanceOf(RevokedServiceHandleError);
    await scope.dispose();
  });
});
