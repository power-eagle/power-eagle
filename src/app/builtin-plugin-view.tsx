/**
 * Host bridge to the v3 runtime: activate a bundled plugin by id with the host
 * Eagle bridge and render its view through the registry-driven renderer. This
 * is the v3 replacement for the v2 runtime-plugin-view PluginWindow.
 */
import React from 'react';
import { activatePlugin, type ActivatedPlugin } from '../sdui/activate';
import { createWidgetRegistry, PluginView } from '../sdui/render/render';
import { getBuiltin } from '../plugins/builtins';

export function BuiltinPluginView(props: {
  pluginId: string;
  eagle: Record<string, unknown>;
}): React.ReactElement {
  const { pluginId, eagle } = props;
  const registry = React.useMemo(() => createWidgetRegistry(), []);
  const module = React.useMemo(() => getBuiltin(pluginId), [pluginId]);
  const [app, setApp] = React.useState<ActivatedPlugin<Record<string, unknown>> | null>(null);

  React.useEffect(() => {
    if (!module) {
      setApp(null);
      return;
    }
    let active = true;
    void activatePlugin(module, eagle).then((activated) => {
      if (active) setApp(activated);
    });
    return () => {
      active = false;
    };
  }, [module, eagle]);

  if (!module) {
    return React.createElement('div', { 'data-state': 'unknown' }, `unknown plugin: ${pluginId}`);
  }
  if (!app) {
    return React.createElement('div', { 'data-state': 'loading' }, 'loading plugin...');
  }
  return React.createElement(PluginView, { app, registry });
}
