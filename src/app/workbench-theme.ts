import { useEffect, useState, type CSSProperties } from 'react';
import { ActivationController, contributionRegistrations } from '../host/activation/controller';
import type { EffectiveRegistry } from '../host/activation/enablement';
import { collectActiveStyling, composeStyle, type ActiveStyling } from '../host/activation/styling';
import { PAPER_POP_IDENTITY, paperPopPackage } from '../plugins/paper-pop';

export const THEME_STORAGE_KEY = 'power-eagle.theme.v1';
export const SHELL_THEME_TARGET = 'power-eagle/shell';
export const shellThemeTokens = new Set([
  'color-scheme', 'background', 'foreground', 'card', 'card-foreground', 'muted', 'muted-foreground',
  'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'border', 'input', 'outline',
  'primary', 'primary-foreground', 'destructive', 'destructive-foreground', 'ring',
  'grid-minor', 'grid-major', 'ground-image', 'ground-size', 'iris-glow', 'iris-glow-failed',
  'radius', 'radius-tag', 'panel-radius', 'frame-radius', 'line-width', 'panel-shadow',
  'control-shadow', 'shadow-panel', 'shell-bar-background', 'source-header', 'stage-header',
  'agent-header', 'selection-background', 'button-outline', 'font-sans', 'font-mono',
]);

export function shellThemeStyle(catalog: ReadonlyMap<string, ActiveStyling>, identity: string): CSSProperties {
  if (!identity || !catalog.get(identity)?.targets.includes(SHELL_THEME_TARGET)) return {};
  const { tokens } = composeStyle(catalog, {
    widget: SHELL_THEME_TARGET, host: { tokens: {}, style: {} }, packageThemes: [{ identity, order: 0 }],
  });
  return Object.fromEntries(Object.entries(tokens).filter(([key]) => shellThemeTokens.has(key)).map(([key, value]) => {
    if (typeof value !== 'string') throw new Error(`Shell theme token ${key} must be a CSS string`);
    return [`--${key}`, value];
  })) as CSSProperties;
}

const themePackages = [paperPopPackage];
const registrations = themePackages.flatMap(item => contributionRegistrations(item.discovered, [item.loaded]));
const themeOptions = themePackages.flatMap(item => item.loaded.exports
  .filter(item => item.descriptor.kind === 'styling' && item.descriptor.targets.includes(SHELL_THEME_TARGET))
  .map(value => ({ identity: `${item.discovered.manifest.id}/${value.descriptor.id}`, label: item.discovered.manifest.name })));

function initialChoice(): string {
  try {
    const saved = JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY) ?? 'null');
    if (saved?.format === 'power-eagle/theme' && saved.formatVersion === 1 && typeof saved.identity === 'string') return saved.identity;
  } catch { /* Unavailable storage starts with the shipped theme. */ }
  return PAPER_POP_IDENTITY;
}

export function useWorkbenchTheme(registry: EffectiveRegistry) {
  const [selected, setSelected] = useState(initialChoice);
  const [catalog, setCatalog] = useState<ReadonlyMap<string, ActiveStyling>>(new Map());
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    const controller = new ActivationController();
    let disposed = false;
    const ids = new Set(registrations.map(item => item.identity));
    const scopedRegistry = {
      ...registry, exports: registry.exports.filter(item => ids.has(item.identity)),
      active: new Map([...registry.active].filter(([identity]) => ids.has(identity))),
    };
    void controller.reconcile(scopedRegistry, registrations).then(async result => {
      if (disposed) { await controller.dispose(); return; }
      setCatalog(collectActiveStyling(scopedRegistry, result.snapshot));
      setError([...result.failures.values()].map(item => item.message).join('\n'));
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; void controller.dispose(); };
  }, [registry]);
  // Revocation takes effect in this render, before asynchronous reconciliation finishes.
  const available = new Map([...catalog].filter(([identity]) => registry.active.has(identity)));
  const effective = selected && available.has(selected) && !error ? selected : '';
  const choose = (identity: string) => {
    setSelected(identity);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ format: 'power-eagle/theme', formatVersion: 1, identity }));
      setSaveError('');
    } catch { setSaveError('Theme applied for this session; the preference could not be saved.'); }
  };
  return {
    selected, choose, effective, style: shellThemeStyle(available, effective), error, saveError,
    unavailable: Boolean(selected && !registry.active.has(selected)),
    options: themeOptions.map(item => ({ ...item, active: registry.active.has(item.identity) })),
  };
}
