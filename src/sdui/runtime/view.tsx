import * as React from 'react';
import type { Json } from '../schema/model';
import type { ResolvedNode, RuntimeCatalog, RuntimeEvent, RuntimeSession } from './session';

export interface WidgetRenderProps {
  node: ResolvedNode;
  props: Record<string, Json>;
  style: React.CSSProperties;
  slots: Record<string, React.ReactNode>;
  events: Record<string, RuntimeEvent>;
}
export type WidgetRenderer = (props: WidgetRenderProps) => React.ReactElement | null;

export function ResolvedView({ node, catalog }: { node: ResolvedNode; catalog: RuntimeCatalog }): React.ReactElement {
  if (node.type === '$fragment') return React.createElement(React.Fragment, null, node.slots.children.map(child => React.createElement(ResolvedView, { key: child.key, node: child, catalog })));
  const definition = catalog.widgets[node.type];
  if (!definition) throw new Error(`No renderer for ${node.type}`);
  const slots = Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [name, children.map(child => React.createElement(ResolvedView, { key: child.key, node: child, catalog }))]));
  return React.createElement(definition.render as React.FC<WidgetRenderProps>, {
    key: node.key, node, props: node.props, style: node.style as React.CSSProperties, slots, events: node.events,
  });
}

export function RuntimeView({ session }: { session: RuntimeSession }): React.ReactElement | null {
  React.useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const node = session.resolve();
  return node ? <ResolvedView node={node} catalog={session.catalog} /> : null;
}
