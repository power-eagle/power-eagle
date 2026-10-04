import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import document from '../../examples/runtime-only/document';

describe('language foundation preview', () => {
  it('renders both component instances and their slots from the public example', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('<p>Count: 0</p>');
    expect(html).toContain('<p>Declarative widgets</p>');
    expect(html).toContain('<button type="button"');
    expect(html).toContain('uses scoped state');
  });
  it('renders script-like text as text', () => {
    const input = JSON.parse(JSON.stringify(document));
    input.screens.home.body = { type: 'Text', props: { text: '<script>alert(1)</script>' } };
    const session = new RuntimeSession(input, foundationRuntimeCatalog);
    const html = renderToStaticMarkup(createElement(RuntimeView, { session }));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
