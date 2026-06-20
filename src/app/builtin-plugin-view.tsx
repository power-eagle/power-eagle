/**
 * Host bridge to the v3 runtime: activate a bundled plugin by id with the host
 * Eagle bridge and render its view through the registry-driven renderer. This
 * is the v3 replacement for the v2 runtime-plugin-view PluginWindow.
 */
import React from 'react';
import { activatePlugin, type ActivatedPlugin } from '../sdui/activate';
import { createWidgetRegistry, PluginView, type WidgetComponent } from '../sdui/render/render';
import { getBuiltin } from '../plugins/builtins';

export function BuiltinPluginView(props: {
  pluginId: string;
  eagle: Record<string, unknown>;
  services?: Record<string, unknown>;
  widgets?: Record<string, WidgetComponent>;
}): React.ReactElement {
  const { pluginId, eagle, services, widgets } = props;
  // Registry preloaded with built-ins, then styling-plugin widgets layered on
  // top (overload existing types / insert new ones).
  const registry = React.useMemo(() => {
    const built = createWidgetRegistry();
    for (const [type, component] of Object.entries(widgets ?? {})) {
      built.register(type, component);
    }
    return built;
  }, [widgets]);
  const module = React.useMemo(() => getBuiltin(pluginId), [pluginId]);
  const [app, setApp] = React.useState<ActivatedPlugin<Record<string, unknown>> | null>(null);

  React.useEffect(() => {
    if (!module) {
      setApp(null);
      return;
    }
    let active = true;
    void activatePlugin(module, eagle, services).then((activated) => {
      if (active) setApp(activated);
    });
    return () => {
      active = false;
    };
  }, [module, eagle, services]);

  if (!module) {
    return React.createElement('div', { 'data-state': 'unknown' }, `unknown plugin: ${pluginId}`);
  }
  if (!app) {
    return React.createElement('div', { 'data-state': 'loading' }, 'loading plugin...');
  }
  return React.createElement(PluginView, { app, registry });
}
