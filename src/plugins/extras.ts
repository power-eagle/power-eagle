/**
 * Extras — a sample styling plugin. It renders nothing of its own; it inserts a
 * `badge` widget type into the renderer registry and contributes a theme (a
 * ghost button variant). Other plugins can then use w('badge', { text }).
 */
import React from 'react';
import { definePlugin } from '../sdui/activate';
import type { WidgetComponent } from '../sdui/render/render';

/** A small pill that renders its `text` prop. */
const badge: WidgetComponent = ({ resolved }) =>
  React.createElement(
    'span',
    { 'data-w': 'badge', className: 'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-foreground' },
    String(resolved.text ?? ''),
  );

export const extras = definePlugin({
  manifest: { id: 'extras', name: 'Extras', version: '1.0.0', styling: true, keywords: ['styling', 'widgets'] },
  widgets: { badge },
  theme: { tokens: {}, widgets: { button: { variants: { ghost: { background: 'transparent' } } } } },
});
