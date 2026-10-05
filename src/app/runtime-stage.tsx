import { useEffect, useState } from 'react';
import { eagleSelectionAdapter } from '../host/eagle-selection';
import type { DiscoveredPackage } from '../host/install/contribution-package';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import type { PluginCatalog } from '../host/workspaces/catalog';
import { createArtifactSession } from '../host/workspaces/runtime';

/** Own the selected view, including startup work and cancellation on replacement. */
export function RuntimeStage({ source, activation, screen, onScreenChange }: {
  source: DiscoveredPackage;
  activation: PluginCatalog;
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
      current = createArtifactSession(source, activation.snapshot().registry, activation.controller, {
        selection: eagleSelectionAdapter(),
      }, relative => {
        const asset = source.assets[relative];
        if (!asset || !activation.loadOptions) throw new Error(`Unavailable package asset ${relative}`);
        return (activation.loadOptions.hostRequire('node:url') as typeof import('node:url')).pathToFileURL(asset).href;
      });
      await current.initialize();
      if (!cancelled) setSession(current);
    };
    void open().catch(error => {
      if (!cancelled) setFailure(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      void current?.dispose().catch(error => console.error('Runtime cleanup failed', error));
    };
  }, [source, activation]);

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
