// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentController } from '../src/index.js';
import { AgentPanel, AgentSettingsPanel } from '../src/react.js';
import { deferred, textHost, writer } from './text-host.js';

afterEach(cleanup);
function setup(generate?: (input: { prompt: string }) => Promise<string>) {
  const fixture = textHost();
  const controller = new AgentController({ host: fixture.host, providers: [writer(generate)] });
  return { ...fixture, controller };
}
describe('standalone Agent panels', () => {
  it('isolates drafts when switching controllers that use the same record ID', async () => {
    const first = setup(); const second = setup();
    await first.controller.draft('a', 'First document draft');
    await second.controller.draft('a', 'Second document draft');
    const view = render(<AgentPanel agent={first.controller} conversationId="a" title="Document" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('First document draft');
    view.rerender(<AgentPanel agent={second.controller} conversationId="a" title="Document" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Second document draft');
  });
  it('renders custom labels/context, sends, navigates revisions and delegates settings placement', async () => {
    const { controller } = setup(); const user = userEvent.setup(); const open = vi.fn();
    render(<AgentPanel agent={controller} conversationId="a" title="Text editor" composerLabel="Change text" contextControls={[{ id: 'dictionary', label: 'Dictionary' }]} revisions={[{ id: 1 }]} onSettings={open} />);
    expect(screen.queryByText('Eagle API')).toBeNull();
    await user.click(screen.getByLabelText('Dictionary')); expect(controller.record('a').context.dictionary).toBe(true);
    await user.type(screen.getByLabelText('Change text'), 'Write a sentence'); await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Open revision 2' });
    await user.click(screen.getByRole('button', { name: 'Open revision 2' })); expect(controller.record('a').selectedBase).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Agent settings' })); expect(open).toHaveBeenCalledTimes(1);
  });

  it('renders a single error, requires draft replacement and focuses the owning composer', async () => {
    const { controller } = setup(async () => { throw Error('Synthetic failure'); });
    await controller.draft('a', 'Original request'); await controller.send('a'); await controller.draft('a', 'Keep this draft');
    const user = userEvent.setup();
    render(<><AgentPanel agent={controller} conversationId="a" title="A" /><AgentPanel agent={controller} conversationId="b" title="B" /></>);
    const panel = within(screen.getByRole('region', { name: 'Agent for A' }));
    expect(screen.getAllByText('Synthetic failure')).toHaveLength(1);
    const a = panel.getByRole('textbox') as HTMLTextAreaElement;
    const b = within(screen.getByRole('region', { name: 'Agent for B' })).getByRole('textbox');
    expect(a.id).not.toBe(b.id);
    await user.click(panel.getByRole('button', { name: 'Edit request 1' })); expect(a.value).toBe('Keep this draft');
    await user.click(panel.getByRole('button', { name: 'Replace draft' }));
    await waitFor(() => expect(a.value).toBe('Original request')); expect(document.activeElement).toBe(a);
    expect(controller.record('a').turns).toHaveLength(1); expect(controller.record('b').draft).toBe('');
  });

  it('clears replacement/error state and loads the correct draft on conversation switches', async () => {
    const { controller } = setup(async () => { throw Error('Failure'); });
    await controller.draft('a', 'Original'); await controller.send('a'); await controller.draft('a', 'Draft A'); await controller.draft('b', 'Draft B');
    const user = userEvent.setup();
    const view = render(<AgentPanel agent={controller} conversationId="a" title="A" />);
    await user.click(screen.getByRole('button', { name: 'Edit request 1' })); expect(screen.getByText('Keep draft')).toBeTruthy();
    view.rerender(<AgentPanel agent={controller} conversationId="b" title="B" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Draft B'); expect(screen.queryByText('Keep draft')).toBeNull();
    view.rerender(<AgentPanel agent={controller} conversationId="a" title="A" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Draft A');
  });

  it('keeps newly typed drafts when a pending generation finishes', async () => {
    const response = deferred<string>(); const { controller } = setup(async () => response.promise); const user = userEvent.setup();
    render(<AgentPanel agent={controller} conversationId="a" title="A" />);
    const input = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(input, 'First'); await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(controller.busy('a')).toBe(true));
    await user.type(input, 'Next unsent request');
    await act(async () => { response.resolve('Result'); });
    await waitFor(() => expect(controller.busy('a')).toBe(false));
    expect(input.value).toBe('Next unsent request'); expect(controller.record('a').draft).toBe(input.value);
  });

  it('restores the draft if no pending record could be saved', async () => {
    const fixture = textHost(); let fail = false;
    const controller = new AgentController({ host: { ...fixture.host, update: (...args) => fail ? Promise.reject(Error('Write failed')) : fixture.host.update(...args) }, providers: [writer()] });
    const user = userEvent.setup(); render(<AgentPanel agent={controller} conversationId="a" title="A" />);
    const input = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(input, 'Keep me'); fail = true; await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(input.value).toBe('Keep me')); expect(screen.getAllByText('Write failed')).toHaveLength(1);
  });

  it('uses registered managed-provider descriptions and persists independent settings', async () => {
    const fixture = textHost(); const provider = writer(); const managed = { ...writer(), id: 'managed', label: 'Organization service', managed: { description: 'Managed by the text editor administrator.' } };
    const controller = new AgentController({ host: fixture.host, providers: [provider, managed] });
    const user = userEvent.setup(); render(<AgentSettingsPanel agent={controller} conversationId="a" />);
    await screen.findByRole('option', { name: 'Text' });
    await user.selectOptions(screen.getByLabelText('Model'), 'text'); await user.selectOptions(screen.getByLabelText('Effort'), 'low');
    await user.selectOptions(screen.getByLabelText('Provider'), 'managed'); expect(screen.getByText(managed.managed.description)).toBeTruthy();
    expect(screen.queryByLabelText('Model')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Provider'), 'writer');
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('text'); expect((screen.getByLabelText('Effort') as HTMLSelectElement).value).toBe('low');
    expect(controller.record('b').settings.choices).toEqual({});
  });

  it('retains unavailable models/effort and exposes loading, refresh and reconnect', async () => {
    const fixture = textHost(); const provider = writer(); const first = deferred<Awaited<ReturnType<typeof provider.adapter.discover>>>();
    const discover = vi.fn().mockReturnValueOnce(first.promise).mockRejectedValueOnce(Error('Service offline')).mockResolvedValue([{ id: 'custom', label: 'Custom', efforts: ['low'] }]);
    provider.adapter.discover = discover;
    const controller = new AgentController({ host: fixture.host, providers: [provider] });
    await controller.settings('a', { provider: 'writer', choices: { writer: { model: 'missing', effort: 'high' } } });
    const user = userEvent.setup(); render(<AgentSettingsPanel agent={controller} conversationId="a" />);
    await screen.findByText('Loading models…');
    await act(async () => { first.resolve([]); });
    expect(screen.getByRole('option', { name: 'missing · not in current catalog' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'high · unavailable' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Refresh models' })); await screen.findByText(/Service offline/);
    await user.click(screen.getByRole('button', { name: 'Reconnect' })); await screen.findByRole('option', { name: 'Custom' });
    expect(controller.record('a').settings.choices.writer).toEqual({ model: 'missing', effort: 'high' });
  });
});
