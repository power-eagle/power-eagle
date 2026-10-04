// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import contentExample from '../../../examples/content-widgets/document';
import { Badge, CodeBlock, Icon, Image, Markdown, RichText, Text, Tooltip } from '../authoring/content';
import { Column } from '../authoring/layout';
import { foundationCatalog } from '../authoring/foundation';
import type { Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const documentWith = (body: Node): RuntimeDocument => ({
  format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], state: {}, components: {}, actions: {},
  screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body } },
});
const sessions: RuntimeSession[] = [];
function renderDocument(body: Node) {
  const session = new RuntimeSession(documentWith(body), foundationRuntimeCatalog);
  sessions.push(session);
  return render(<RuntimeView session={session} />);
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('content and presentation widget family', () => {
  it('renders text, rich spans, Markdown, and code as non-executing content', () => {
    const attack = '<img src=x onerror="globalThis.__powerEagleExecuted=true"><script>globalThis.__powerEagleExecuted=true</script>';
    const { container } = renderDocument(Column.node({}, { slots: { children: [
      Text.node({ text: attack }),
      RichText.node({ spans: [{ text: '<b>plain</b>', tone: 'primary', weight: 'semibold' }] }),
      Markdown.node({ text: `Safe **formatting** ${attack} [blocked](javascript:alert(1))` }),
      CodeBlock.node({ code: attack, language: 'html' }),
    ] } }));

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-pe-widget="Text"]')?.textContent).toBe(attack);
    expect(container.querySelector('[data-pe-widget="RichText"]')?.textContent).toBe('<b>plain</b>');
    expect(container.querySelector('[data-pe-widget="Markdown"] strong')?.textContent).toBe('formatting');
    expect(container.querySelector('[data-pe-widget="Markdown"] a')).toBeNull();
    expect(container.querySelector('[data-pe-widget="CodeBlock"] code')?.textContent).toContain(attack);
    expect((globalThis as { __powerEagleExecuted?: boolean }).__powerEagleExecuted).toBeUndefined();
  });

  it('contains image failure and shows declared accessible alternative content', () => {
    const { container } = renderDocument(Image.node({
      src: 'https://invalid.example/missing.png', alt: 'Missing preview', failureText: 'Could not load preview', width: 160, height: 80, fit: 'scaleDown',
    }, { slots: { failure: Text.node({ text: 'Package preview unavailable' }) } }));

    const root = container.querySelector<HTMLElement>('[data-pe-widget="Image"]')!;
    expect(root.dataset.state).toBe('loading');
    expect(root.getAttribute('aria-busy')).toBe('true');
    const image = screen.getByAltText('Missing preview');
    expect(image.style.objectFit).toBe('scale-down');
    fireEvent.error(image);
    const failure = container.querySelector<HTMLElement>('[data-pe-widget="Image"]')!;
    expect(failure.dataset.state).toBe('error');
    expect(failure.getAttribute('role')).toBe('img');
    expect(failure.getAttribute('aria-label')).toBe('Missing preview');
    expect(failure.textContent).toContain('Package preview unavailable');
    expect([failure.style.width, failure.style.height]).toEqual(['160px', '80px']);
  });

  it('opens tooltips for keyboard focus and exposes icon semantics', async () => {
    const user = userEvent.setup();
    const { container } = renderDocument(Tooltip.node({ message: 'Generated package', side: 'right', delay: 0 }, {
      slots: { child: Icon.node({ name: 'sparkles', semanticLabel: 'Generated' }) },
    }));

    const root = container.querySelector<HTMLElement>('[data-pe-widget="Tooltip"]')!;
    const trigger = container.querySelector<HTMLElement>('.pe-tooltip-trigger')!;
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(root.dataset.open).toBe('false');
    expect(tooltip.getAttribute('aria-hidden')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    expect(root.dataset.open).toBe('true');
    expect(tooltip.getAttribute('aria-hidden')).toBe('false');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    const icon = screen.getByRole('img', { name: 'Generated' });
    expect(icon.getAttribute('data-pe-widget')).toBe('Icon');
  });

  it('applies node theme styles after content defaults', () => {
    const { container } = renderDocument(Column.node({}, { slots: { children: [
      Text.node({ text: 'Themed', variant: 'meta' }, { style: { color: 'rgb(1, 2, 3)', fontWeight: 700 } }),
      Badge.node({ text: 'active', variant: 'default' }, { style: { backgroundColor: 'rgb(4, 5, 6)' } }),
    ] } }));
    const text = container.querySelector<HTMLElement>('[data-pe-widget="Text"]')!;
    const badge = container.querySelector<HTMLElement>('[data-pe-widget="Badge"]')!;
    expect([text.style.color, text.style.fontWeight]).toEqual(['rgb(1, 2, 3)', '700']);
    expect(badge.classList.contains('pe-badge-default')).toBe(true);
    expect(badge.style.backgroundColor).toBe('rgb(4, 5, 6)');
  });

  it('publishes a valid runnable example and all content contracts', () => {
    expect(validateRuntime(contentExample, foundationCatalog).success).toBe(true);
    expect(Object.keys(foundationCatalog.widgets)).toEqual(expect.arrayContaining([
      'Text', 'RichText', 'SelectableText', 'Markdown', 'CodeBlock', 'Image', 'Icon', 'Badge', 'Divider', 'Card', 'Tooltip',
    ]));
    const session = new RuntimeSession(contentExample, foundationRuntimeCatalog, {}, path => `asset://${path}`);
    sessions.push(session);
    const { container } = render(<RuntimeView session={session} />);
    for (const type of ['Text', 'RichText', 'SelectableText', 'Markdown', 'CodeBlock', 'Image', 'Icon', 'Badge', 'Divider', 'Card', 'Tooltip']) {
      expect(container.querySelector(`[data-pe-widget="${type}"]`), type).not.toBeNull();
    }
  });
});
