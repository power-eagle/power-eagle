import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import document from '../../examples/runtime-only/document';

describe('language foundation preview', () => {
  it('renders the shell before opening a runtime after mount', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Opening Runtime flow');
    expect(html).not.toContain('data-pe-widget=');
    expect(html).toContain('<button type="button"');
    expect(html).toContain('01 / Sources');
    expect(html).toContain('02 / Stage');
    expect(html).toContain('03 / Agent');
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
