/**
 * Host bridge to the v3 runtime: activate an already-resolved plugin module
 * (bundled built-in or disk-loaded) with the host Eagle bridge and render its
 * view through the registry-driven renderer. Resolving *which* module to run is
 * the host service's loadModule; this view just runs the one it is handed.
 */
import React from 'react';
import { activatePlugin, type ActivatedPlugin } from '../sdui/activate';
import { createWidgetRegistry, PluginView, type WidgetComponent } from '../sdui/render/render';
import type { AnyPluginModule } from '../plugins/builtins';

export function PluginRuntimeView(props: {
  module: AnyPluginModule;
  eagle: Record<string, unknown>;
  services?: Record<string, unknown>;
  widgets?: Record<string, WidgetComponent>;
}): React.ReactElement {
  const { module, eagle, services, widgets } = props;
  // Registry preloaded with built-ins, then styling-plugin widgets layered on
  // top (overload existing types / insert new ones).
  const registry = React.useMemo(() => {
    const built = createWidgetRegistry();
    for (const [type, component] of Object.entries(widgets ?? {})) {
      built.register(type, component);
    }
    return built;
  }, [widgets]);
  const [app, setApp] = React.useState<ActivatedPlugin<Record<string, unknown>> | null>(null);

  React.useEffect(() => {
    let active = true;
    setApp(null);
    void activatePlugin(module, eagle, services).then((activated) => {
      if (active) setApp(activated);
    });
    return () => {
      active = false;
    };
  }, [module, eagle, services]);

  if (!app) {
    return React.createElement('div', { 'data-state': 'loading' }, 'loading plugin...');
  }
  return React.createElement(PluginView, { app, registry });
}
