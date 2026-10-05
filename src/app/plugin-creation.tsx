import { useEffect, useRef, useState } from 'react';
import type { PluginCatalog, CatalogEntry } from '../host/workspaces/catalog';
import type { PluginInstance } from '../host/workspaces/model';
import { Button, Input } from '../components/ui';

export function usePluginCreation(catalog: PluginCatalog, selected: CatalogEntry | undefined, onCreated: (instance: PluginInstance) => void) {
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState<{ source?: { instanceId: string; revision: number }; name: string }>();
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController>();
  useEffect(() => { if (menu) first.current?.focus(); }, [menu]);
  const formOpen = Boolean(form);
  useEffect(() => { if (formOpen) input.current?.focus(); }, [formOpen]);
  useEffect(() => () => operation.current?.abort(), []);
  const cancel = () => { operation.current?.abort(); setForm(undefined); setMenu(false); setError(''); button.current?.focus(); };
  const open = (duplicate: boolean) => {
    setMenu(false); setError(''); setProgress('');
    setForm(duplicate && selected ? { name: `${selected.instance.name} copy`, source: { instanceId: selected.instance.instanceId, revision: selected.instance.currentRevision } } : { name: 'Untitled plugin' });
  };
  const submit = async () => {
    if (operation.current || !form || !form.name.trim()) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); setProgress('Saving plugin…');
    try {
      const instance = await catalog.create(form.name.trim(), form.source, { signal: controller.signal, progress: files => setProgress(`Copying ${files} files…`) });
      setForm(undefined); onCreated(instance); button.current?.focus();
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { operation.current = undefined; setBusy(false); setProgress(''); }
  };
  return {
    actions: <div className="pe-new-plugin" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); cancel(); } }}>
      <button ref={button} type="button" className="pe-rail-btn" aria-label="New plugin" aria-haspopup="menu" aria-expanded={menu} disabled={busy}
        onClick={() => { setMenu(value => !value); setForm(undefined); }}>+</button>
      {menu ? <div role="menu" aria-label="New plugin" className="pe-plugin-menu" onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
        }
      }}>
        <button ref={first} type="button" role="menuitem" onClick={() => open(false)}>Blank plugin</button>
        <button type="button" role="menuitem" disabled={!selected || Boolean(selected.failure)} onClick={() => open(true)}>Duplicate selected plugin</button>
      </div> : null}
    </div>,
    form: form ? <form className="pe-plugin-create" aria-label={form.source ? 'Duplicate plugin' : 'Blank plugin'}
      onSubmit={event => { event.preventDefault(); void submit(); }} onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
      <label htmlFor="plugin-name">{form.source ? 'Name your copy' : 'Name your plugin'}</label>
      <Input ref={input} id="plugin-name" value={form.name} maxLength={120} disabled={busy} onChange={event => setForm({ ...form, name: event.currentTarget.value })} />
      {progress ? <small role="status">{progress}</small> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div><Button type="submit" size="sm" disabled={busy || !form.name.trim()}>Create</Button><Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button></div>
    </form> : null,
  };
}
