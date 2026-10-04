// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../examples/collection-feedback-media/document';
import manifest from '../../../examples/collection-feedback-media/manifest.json';
import { compile } from '../authoring';
import { foundationCatalog } from '../authoring/foundation';
import type { Node } from '../schema/model';
import { validatePackage, validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession } from './session';
import { RuntimeView } from './view';

const widgetTypes = [
  'ScrollView', 'ListView', 'GridView', 'VirtualList', 'VirtualGrid', 'ReorderableList', 'TreeView', 'DataTable', 'PropertyGrid',
  'ProgressIndicator', 'Skeleton', 'EmptyState', 'ErrorState', 'Banner', 'Toast', 'Dialog',
  'ImageGallery', 'ZoomableImage', 'AudioPlayer', 'VideoPlayer',
] as const;
const sessions: RuntimeSession[] = [];

function nodeTypes(node: Node, result = new Set<string>()): Set<string> {
  result.add(node.type);
  Object.values(node.slots ?? {}).flatMap(slot => Array.isArray(slot) ? slot : [slot]).forEach(child => nodeTypes(child, result));
  if (node.empty) nodeTypes(node.empty, result);
  return result;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation(() => 'probably');
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  vi.restoreAllMocks();
});

describe('public collection-feedback-media example', () => {
  it('compiles every referenced contract and renders every implementation through the public runtime', () => {
    expect(validatePackage(manifest).success).toBe(true);
    expect(validateRuntime(example, foundationCatalog).success).toBe(true);
    expect(validateRuntime(JSON.parse(compile(example, foundationCatalog)), foundationCatalog).success).toBe(true);
    const referenced = new Set<string>();
    Object.values(example.screens).forEach(screen => nodeTypes(screen.body, referenced));
    for (const type of widgetTypes) {
      expect(referenced.has(type), `${type} example reference`).toBe(true);
      expect(foundationCatalog.widgets[type], `${type} public contract`).toBeTruthy();
    }

    const session = new RuntimeSession(example, foundationRuntimeCatalog);
    sessions.push(session);
    const { container } = render(<RuntimeView session={session} />);
    for (const type of widgetTypes) expect(container.querySelector(`[data-pe-widget="${type}"]`), type).not.toBeNull();
  });

  it('combines controlled collection, feedback, gallery, and zoom behavior in one runtime', async () => {
    const session = new RuntimeSession(example, foundationRuntimeCatalog);
    sessions.push(session);
    const user = userEvent.setup();
    const { container } = render(<RuntimeView session={session} />);

    await user.click(screen.getByRole('option', { name: 'Beta package' }));
    await waitFor(() => expect(session.globalState.read(['listSelection'])).toEqual(['beta']));

    await user.click(screen.getByRole('button', { name: 'Notify me' }));
    const toast = screen.getByText('Notification requested').closest('[role="status"]');
    expect(toast).not.toBeNull();
    expect(toast?.closest('[data-pe-runtime-stage]')).toBe(container.querySelector('[data-pe-runtime-stage]'));

    const review = screen.getByRole('button', { name: 'Review' });
    await user.click(review);
    expect(await screen.findByRole('dialog', { name: 'Review package' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close review' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(review);

    await user.click(screen.getByRole('option', { name: /Blue package previewBlue/u }));
    await waitFor(() => expect(session.globalState.read(['gallerySelection'])).toBe('blue'));
    await user.click(screen.getByRole('button', { name: '+' }));
    await waitFor(() => expect(session.globalState.read(['zoom'])).toBe(1.25));
    expect(screen.getByLabelText('Zoom level').textContent).toBe('125%');
  });
});
