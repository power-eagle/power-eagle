// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import example from '../../../examples/control-widgets/document';
import manifest from '../../../examples/control-widgets/manifest.json';
import { compile } from '../authoring';
import { foundationCatalog } from '../authoring/foundation';
import type { Node } from '../schema/model';
import { validatePackage, validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const controlTypes = [
  'Form', 'TextField', 'TextArea', 'NumberField', 'Checkbox', 'RadioGroup', 'Switch',
  'Select', 'Autocomplete', 'Slider', 'DatePicker', 'ColorPicker', 'FilePicker',
  'Button', 'IconButton', 'SegmentedControl', 'Tabs', 'Accordion', 'Menu', 'ContextMenu', 'Breadcrumbs', 'SplitPane',
] as const;
const sessions: RuntimeSession[] = [];

function nodeTypes(node: Node, result = new Set<string>()): Set<string> {
  result.add(node.type);
  Object.values(node.slots ?? {}).flatMap(slot => Array.isArray(slot) ? slot : [slot]).forEach(child => nodeTypes(child, result));
  if (node.empty) nodeTypes(node.empty, result);
  return result;
}

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

describe('public control-widgets example', () => {
  it('compiles every referenced control schema and renders every implementation through the public runtime', () => {
    expect(validatePackage(manifest).success).toBe(true);
    expect(validateRuntime(example, foundationCatalog).success).toBe(true);
    expect(validateRuntime(JSON.parse(compile(example, foundationCatalog)), foundationCatalog).success).toBe(true);
    const referenced = new Set<string>();
    Object.values(example.screens).forEach(screen => nodeTypes(screen.body, referenced));
    for (const type of controlTypes) {
      expect(referenced.has(type), `${type} example reference`).toBe(true);
      expect(foundationCatalog.widgets[type], `${type} public contract`).toBeTruthy();
    }

    const session = new RuntimeSession(example, foundationRuntimeCatalog, { selection: vi.fn().mockResolvedValue(['C:\\fixtures\\source.json']) });
    sessions.push(session);
    const { container } = render(<RuntimeView session={session} />);
    for (const type of controlTypes) expect(container.querySelector(`[data-pe-widget="${type}"]`), type).not.toBeNull();
  });

  it('completes form submission and screen navigation using only keyboard input', async () => {
    const selection = vi.fn().mockResolvedValue(['C:\\fixtures\\source.json']);
    const session = new RuntimeSession(example, foundationRuntimeCatalog, { selection });
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Display name/u }));
    await user.keyboard('Ada');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /Accept terms/u }));
    await user.keyboard(' ');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose source' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.globalState.read(['files'])).toEqual(['C:\\fixtures\\source.json']));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Submit profile' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.globalState.read(['submission'])).toEqual({
      name: 'Ada', terms: true, files: ['C:\\fixtures\\source.json'],
    }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Review' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(session.navigation.current.screen).toBe('review'));
    expect(screen.getByText('Review screen')).toBeTruthy();
    expect(selection).toHaveBeenCalledTimes(1);
  });
});
