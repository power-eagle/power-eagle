import { useRef, useState } from 'react';
import { Button, Input } from '../components/ui';
import type { WorkbenchAcquisition } from '../host/install/workbench-acquisition';
import type { PackageRequest } from '../host/install/saucepan-client';
import type { CatalogEntry } from '../host/workspaces/catalog';

export function PackageControls({ acquisition, selected, onSelect, unavailableReason }: {
  acquisition?: WorkbenchAcquisition; selected?: CatalogEntry; onSelect(id: string): void; unavailableReason?: string;
}) {
  const [kind, setKind] = useState<'local' | 'git' | 'url'>('local');
  const [source, setSource] = useState('');
  const [selector, setSelector] = useState<'ref' | 'commit'>('ref');
  const [revision, setRevision] = useState('HEAD');
  const [folder, setFolder] = useState('');
  const [format, setFormat] = useState<'zip' | 'raw'>('zip');
  const [filename, setFilename] = useState('manifest.json');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const running = useRef(false);
  const unavailable = unavailableReason ?? acquisition?.unavailable ?? (!acquisition ? 'Open Power Eagle in Eagle to manage source packages.' : undefined);
  const run = async (label: string, action: () => Promise<unknown>, success = '') => {
    if (running.current) return;
    running.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); setNotice(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { running.current = false; setBusy(''); }
  };
  const request = (): PackageRequest => {
    const value = source.trim();
    if (!value) throw new Error('Enter a source.');
    if (kind === 'git' && !revision.trim()) throw new Error('Enter a Git reference or commit.');
    const selection = { ...(folder.trim() ? { folder: folder.trim() } : {}),
      ...(kind === 'url' ? { format, ...(format === 'raw' ? { filename: filename.trim() } : {}) } : {}) };
    return {
      source: kind === 'local' ? { type: 'local', path: value } : kind === 'url' ? { type: 'url', url: value } : { type: 'git', origin: value },
      selector: kind === 'local' ? { type: 'local' } : kind === 'url' ? { type: 'url' } : selector === 'commit' ? { type: 'commit', commit: revision.trim() } : { type: 'ref', reference: revision.trim() },
      ...(Object.keys(selection).length ? { selection } : {}),
    };
  };
  return <section className="pe-package-controls" aria-label="Package management">
    {unavailable ? <p role="status">{unavailable}</p> : <>
      {selected?.session ? <div className="pe-package-current"><small>Session preview</small>
        <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void run('Closing preview…', () => acquisition!.closePreview(selected.instance.instanceId))}>Close preview</Button>
      </div> : selected?.instance.acquisition ? <div className="pe-package-current">
        <small>Installed source · revision {selected.instance.acquisition.revision}</small>
        <div><Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void run('Refreshing source…', async () => {
          const installed = await acquisition!.refresh(selected.instance.instanceId); onSelect(installed.instanceId);
        }, 'Source refreshed.')}>Refresh source</Button>
        <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void run('Removing installation…', () => acquisition!.remove(selected.instance.instanceId), 'Installation removed. Independent copies are preserved.')}>Remove installation</Button></div>
      </div> : null}
      <details><summary>Add package</summary>
        <form aria-label="Add source package" onSubmit={event => {
          event.preventDefault(); void run('Installing package…', async () => { const installed = await acquisition!.install(request()); onSelect(installed.instanceId); }, 'Package installed.');
        }}>
          <fieldset disabled={Boolean(busy)}>
            <label>Source type<select value={kind} onChange={event => setKind(event.currentTarget.value as typeof kind)}>
              <option value="local">Local folder</option><option value="git">Git repository</option><option value="url">URL download</option>
            </select></label>
            <label>Package source<Input value={source} onChange={event => setSource(event.currentTarget.value)} placeholder={kind === 'local' ? 'Path to a package folder' : 'https://…'} required /></label>
            {kind === 'git' ? <>
              <label>Git selection<select value={selector} onChange={event => setSelector(event.currentTarget.value as typeof selector)}><option value="ref">Branch or tag</option><option value="commit">Exact commit</option></select></label>
              <label>Git revision<Input value={revision} onChange={event => setRevision(event.currentTarget.value)} required /></label>
            </> : null}
            {kind === 'url' ? <><label>Download format<select value={format} onChange={event => setFormat(event.currentTarget.value as typeof format)}><option value="zip">ZIP archive</option><option value="raw">Single file</option></select></label>
              {format === 'raw' ? <label>Saved filename<Input value={filename} onChange={event => setFilename(event.currentTarget.value)} required /></label> : null}</> : null}
            <label>Package subfolder (optional)<Input value={folder} onChange={event => setFolder(event.currentTarget.value)} /></label>
            <div><Button size="sm" type="submit" disabled={!source.trim()}>Install</Button>
              <Button size="sm" type="button" variant="secondary" disabled={!source.trim()} onClick={() => void run('Opening preview…', async () => onSelect(await acquisition!.preview(request())))}>Preview</Button></div>
          </fieldset>
        </form>
      </details>
      <details><summary>Package store setup</summary><p>Initialize the independently installed Saucepan store before its first use. Existing stores are preserved.</p>
        <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void run('Initializing package store…', () => acquisition!.setup(), 'Package store is ready.')}>Initialize store</Button>
      </details>
    </>}
    {busy || notice ? <p role="status">{busy || notice}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
