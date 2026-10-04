// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import layoutExample from '../../../examples/layout-widgets/document';
import {
  Align, AspectRatio, Center, Column, ConstrainedBox, Expanded, Flexible, Padding, Positioned, Row, SizedBox, Spacer, Stack, Wrap,
} from '../authoring/layout';
import { Text, foundationCatalog } from '../authoring/foundation';
import type { Node, RuntimeDocument } from '../schema/model';
import { validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const child = (text: string) => Text.node({ text });
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
function widget(container: HTMLElement, type: string): HTMLElement {
  const result = container.querySelector<HTMLElement>(`[data-pe-widget="${type}"]`);
  if (!result) throw new Error(`Missing ${type}`);
  return result;
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('layout widget family', () => {
  it('renders flex allocation and axis behavior from the public runtime', () => {
    const { container } = renderDocument(Row.node({ gap: 8, mainAxisAlignment: 'spaceBetween', crossAxisAlignment: 'stretch' }, {
      slots: { children: [
        SizedBox.node({ width: 48, height: 24 }),
        Expanded.node({ flex: 2 }, { slots: { child: child('expanded') } }),
        Flexible.node({ flex: 3, fit: 'tight' }, { slots: { child: child('tight') } }),
        Flexible.node({ flex: 1, fit: 'loose' }, { slots: { child: child('loose') } }),
        Spacer.node({ flex: 4 }),
      ] },
    }));

    const row = widget(container, 'Row');
    expect(row.style.display).toBe('flex');
    expect(row.style.flexDirection).toBe('row');
    expect(row.style.gap).toBe('8px');
    expect(row.style.justifyContent).toBe('space-between');
    expect(row.style.alignItems).toBe('stretch');

    const expanded = widget(container, 'Expanded');
    expect(expanded.style.flexGrow).toBe('2');
    expect(expanded.style.flexShrink).toBe('1');
    expect(expanded.style.flexBasis).toBe('0px');

    const flexible = container.querySelectorAll<HTMLElement>('[data-pe-widget="Flexible"]');
    expect(flexible[0].style.flexGrow).toBe('3');
    expect(flexible[0].style.flexBasis).toBe('0px');
    expect(flexible[1].style.flexBasis).toBe('auto');
    expect(widget(container, 'Spacer').style.flexGrow).toBe('4');
  });

  it('renders wrapping, constraints, positioning, alignment, padding, and explicit style precedence', () => {
    const { container } = renderDocument(Column.node({ gap: 5 }, { slots: { children: [
      Wrap.node({ direction: 'column', gap: 6, runGap: 10, alignment: 'center', crossAxisAlignment: 'end' }, {
        slots: { children: [child('one'), child('two')] },
      }),
      Padding.node({ all: 1, horizontal: 2, vertical: 3, top: 4, left: 5 }, { slots: { child: child('padded') } }),
      Align.node({ alignment: 'bottomRight' }, { slots: { child: child('aligned') } }),
      Center.node({}, { slots: { child: child('centered') } }),
      SizedBox.node({ width: 99, height: 44 }, { slots: { child: child('sized') }, style: { width: '120px' } }),
      ConstrainedBox.node({ minWidth: 80, maxWidth: 240, minHeight: 32, maxHeight: 96 }, { slots: { child: child('constrained') } }),
      AspectRatio.node({ aspectRatio: 1.5 }, { slots: { child: child('ratio') } }),
      Stack.node({ alignment: 'center', overflow: 'visible' }, { slots: { children: [
        child('base'),
        Positioned.node({ left: 7, top: 9, width: 40, height: 20 }, { slots: { child: child('positioned') } }),
      ] } }),
    ] } }));

    expect(widget(container, 'Column').style.gap).toBe('5px');
    const wrap = widget(container, 'Wrap');
    expect(wrap.style.flexDirection).toBe('column');
    expect(wrap.style.flexWrap).toBe('wrap');
    expect(wrap.style.columnGap).toBe('6px');
    expect(wrap.style.rowGap).toBe('10px');
    expect(wrap.style.justifyContent).toBe('center');
    expect(wrap.style.alignItems).toBe('flex-end');

    const padding = widget(container, 'Padding');
    expect([padding.style.paddingTop, padding.style.paddingRight, padding.style.paddingBottom, padding.style.paddingLeft]).toEqual(['4px', '2px', '3px', '5px']);
    const align = widget(container, 'Align');
    expect([align.style.alignItems, align.style.justifyItems]).toEqual(['end', 'end']);
    const center = widget(container, 'Center');
    expect([center.style.alignItems, center.style.justifyItems]).toEqual(['center', 'center']);

    const sized = widget(container, 'SizedBox');
    expect([sized.style.width, sized.style.height]).toEqual(['120px', '44px']);
    const constrained = widget(container, 'ConstrainedBox');
    expect([constrained.style.minWidth, constrained.style.maxWidth, constrained.style.minHeight, constrained.style.maxHeight]).toEqual(['80px', '240px', '32px', '96px']);
    expect(widget(container, 'AspectRatio').style.aspectRatio).toContain('1.5');

    const stack = widget(container, 'Stack');
    expect([stack.style.position, stack.style.overflow, stack.style.alignItems, stack.style.justifyItems]).toEqual(['relative', 'visible', 'center', 'center']);
    const positioned = widget(container, 'Positioned');
    expect([positioned.style.position, positioned.style.left, positioned.style.top, positioned.style.width, positioned.style.height]).toEqual(['absolute', '7px', '9px', '40px', '20px']);
  });

  it('publishes one valid example that exercises every layout contract', () => {
    expect(validateRuntime(layoutExample, foundationCatalog).success).toBe(true);
    expect(Object.keys(foundationCatalog.widgets)).toEqual(expect.arrayContaining([
      'Row', 'Column', 'Stack', 'Positioned', 'Wrap', 'Padding', 'Align', 'Center', 'SizedBox', 'ConstrainedBox',
      'Expanded', 'Flexible', 'Spacer', 'AspectRatio',
    ]));
  });

  it('reports invalid parent-child placement at each offending widget', () => {
    const invalid = Column.node({}, { slots: { children: [
      Row.node({}, { slots: { children: [
        Positioned.node({ left: 0 }, { slots: { child: child('wrong parent') } }),
      ] } }),
      Stack.node({}, { slots: { children: [
        Expanded.node({}, { slots: { child: child('expanded') } }),
        Flexible.node({}, { slots: { child: child('flexible') } }),
        Spacer.node({}),
      ] } }),
    ] } });
    const result = validateRuntime(documentWith(invalid), foundationCatalog);
    expect(result.success).toBe(false);
    if (result.success) return;
    const parents = result.diagnostics.filter(item => item.code === 'parent');
    expect(parents.map(item => item.path)).toEqual([
      '/screens/home/body/slots/children/0/slots/children/0/type',
      '/screens/home/body/slots/children/1/slots/children/0/type',
      '/screens/home/body/slots/children/1/slots/children/1/type',
      '/screens/home/body/slots/children/1/slots/children/2/type',
    ]);
    expect(parents.map(item => item.message)).toEqual([
      'Required parent: Stack', 'Required parent: Row, Column', 'Required parent: Row, Column', 'Required parent: Row, Column',
    ]);
  });
});
