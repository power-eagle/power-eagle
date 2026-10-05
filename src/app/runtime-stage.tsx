import { useEffect, useState } from 'react';
import type { EagleCapabilities } from '../host/eagle-capabilities';
import { eagleSelectionAdapter } from '../host/eagle-selection';
import type { DiscoveredPackage } from '../host/install/contribution-package';
import { builtinToolCatalog } from '../plugins/builtin-tool';
import { getBuiltinTool } from '../plugins/builtins';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import type { WorkbenchActivationModel } from './workbench-activation';

/** Own the selected view, including startup work and cancellation on replacement. */
export function RuntimeStage({ source, capabilities, activation, screen, onScreenChange }: {
  source: DiscoveredPackage;
  capabilities: EagleCapabilities;
  activation: WorkbenchActivationModel;
  screen?: string;
  onScreenChange(screen: string): void;
}) {
  const [session, setSession] = useState<RuntimeSession>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let current: RuntimeSession | undefined;
    setSession(undefined);
    setFailure(undefined);
    const open = async () => {
      const tool = getBuiltinTool(source.manifest.id);
      const calls = Object.fromEntries(Object.entries(tool?.calls(capabilities) ?? {}).map(([identity, adapter]) => [identity, {
        ...adapter,
        invoke: (...args: Parameters<typeof adapter.invoke>) => {
          const state = activation.snapshot().exports.find(item => item.identity === identity);
          if (state?.effectiveStatus !== 'active') throw new Error(`Export ${identity} is unavailable`);
          return adapter.invoke(...args);
        },
      }]));
      current = new RuntimeSession(source.runtime, tool ? builtinToolCatalog(tool) : foundationRuntimeCatalog, {
        calls, selection: eagleSelectionAdapter(),
      });
      for (const action of tool?.initialize ?? []) {
        if (cancelled) return;
        await current.run(action);
      }
      if (!cancelled) setSession(current);
    };
    void open().catch(error => {
      if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      void current?.dispose().catch(error => console.error('Runtime cleanup failed', error));
    };
  }, [source, capabilities, activation]);

  useEffect(() => {
    if (!session) return;
    return session.navigation.subscribe(() => onScreenChange(session.navigation.current.screen));
  }, [session, onScreenChange]);

  useEffect(() => {
    if (!session) return;
    setFailure(undefined);
    if (!screen || screen === session.navigation.current.screen) return;
    let cancelled = false;
    void session.navigation.navigate('reset', screen, {}).catch(error => {
      if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, [session, screen]);

  if (failure) return <div className="pe-workbench-stage-error" role="alert">
    <strong>This view could not open.</strong><p>{failure}</p>
    <p>Select another screen or reopen this tool to retry.</p>
  </div>;
  if (!session) return <p role="status">Opening {source.manifest.name}…</p>;
  return <RuntimeView session={session} />;
}
