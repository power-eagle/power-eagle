import { useEffect, useRef, useState } from 'react';
import { Badge, Input } from '../components/ui';
import type { EffectiveRegistry } from '../host/activation/enablement';
import {
  defaultSelection, selectionMatchesRecord, workbenchPackageKey, type WorkbenchPackage, type WorkbenchSelection,
} from './workbench-selection';

function SourceToggle({ name, enabled, status, onToggle }: {
  name: string;
  enabled: boolean;
  status: string;
  onToggle(): void;
}) {
  const label = `${enabled ? 'Disable' : 'Enable'} ${name}`;
  return <button type="button" role="switch" aria-checked={enabled} aria-label={label}
    aria-description={`Currently ${status}`} title={`${label} · currently ${status}`}
    className={`pe-iris${status === 'failed' ? ' pe-iris-failed' : status === 'active' ? ' pe-iris-on' : ''}`}
    onClick={onToggle}>
    <span className="pe-iris-dot" aria-hidden="true" />
  </button>;
}

export function WorkbenchSourceTree({
  packages, selection, onSelect,
  registry, onTogglePackage, filter, onFilter, onMove, onInspect,
}: {
  packages: readonly WorkbenchPackage[];
  selection: WorkbenchSelection;
  onSelect(selection: WorkbenchSelection): void;
  registry?: EffectiveRegistry;
  onTogglePackage?(packageId: string, enabled: boolean): void;
  onInspect?(record: WorkbenchPackage): void;
  filter?: string;
  onFilter?(value: string): void;
  onMove?(id: string, before: string | null): void;
}) {
  const [localQuery, setLocalQuery] = useState('');
  const query = filter ?? localQuery;
  const setQuery = onFilter ?? setLocalQuery;
  const [menuError, setMenuError] = useState('');
  const [menu, setMenu] = useState<{ items: { id: string; label: string; enabled?: boolean; click(): void }[]; x: number; y: number; trigger: HTMLElement }>();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(undefined);
    };
    const close = () => setMenu(undefined);
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', close); };
  }, [menu]);
  const latest = useRef({ packages, query, onMove, onInspect });
  latest.current = { packages, query, onMove, onInspect };
  const openMenu = async (record: WorkbenchPackage, trigger: HTMLElement, x?: number, y?: number) => {
    setMenuError('');
    setMenu(undefined);
    const id = record.instanceId;
    const index = packages.indexOf(record);
    const move = (direction: -1 | 1) => {
      const current = latest.current;
      const position = current.packages.findIndex(item => item.instanceId === id);
      if (!id || current.query.trim() || position < 0 || position + direction < 0 || position + direction >= current.packages.length) return;
      current.onMove?.(id, direction === -1 ? current.packages[position - 1].instanceId! : current.packages[position + 2]?.instanceId ?? null);
    };
    const items = [
      ...(onInspect ? [{ id: 'inspect-plugin', label: 'Inspect plugin…', click: () => {
        const target = latest.current.packages.find(item => workbenchPackageKey(item) === workbenchPackageKey(record));
        if (target) latest.current.onInspect?.(target);
      } }] : []),
      ...(onMove && id ? [
        { id: 'move-up', label: 'Move up', enabled: !query.trim() && index > 0, click: () => move(-1) },
        { id: 'move-down', label: 'Move down', enabled: !query.trim() && index < packages.length - 1, click: () => move(1) },
        ...(query.trim() ? [{ id: 'clear-filter', label: 'Clear filter to change order', click: () => setQuery('') }] : []),
      ] : []),
    ];
    if (!items.length) return;
    try {
      if (typeof eagle !== 'undefined' && eagle.contextMenu?.open) await eagle.contextMenu.open(items);
      else {
        const rect = trigger.getBoundingClientRect();
        setMenu({ items, trigger, x: Math.max(8, Math.min(x ?? rect.left, window.innerWidth - 240)), y: Math.max(8, Math.min(y ?? rect.bottom, window.innerHeight - 180)) });
      }
    } catch (reason) { setMenuError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const filtered = packages.filter(record => {
    const text = [record.manifest.name, record.manifest.id, record.manifest.description,
      record.sourceLabel, sourceGroupLabel(record.sourceKind, record.sourceLabel)].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  return <nav className="pe-workbench-source-tree" aria-label="Package sources">
    <div className="pe-plugin-search">
      <Input size="sm" type="search" aria-label="Filter plugins" placeholder="Filter plugins…"
        value={query} onChange={event => setQuery(event.currentTarget.value)} />
      {query ? <button type="button" aria-label="Clear plugin filter" onClick={() => setQuery('')}>×</button> : null}
    </div>
    {menu ? <div ref={menuRef} className="pe-source-context-menu" role="menu" aria-label="Plugin options" style={{ left: menu.x, top: menu.y }}
      onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault();
          menu.trigger.focus(); setMenu(undefined);
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}>
      {menu.items.map(item => <button type="button" role="menuitem" key={item.id} disabled={item.enabled === false}
        onClick={() => { menu.trigger.focus(); setMenu(undefined); item.click(); }}>{item.label}</button>)}
    </div> : null}
    {menuError ? <p role="alert">{menuError}</p> : null}
    {filtered.length === 0 ? <p className="pe-plugin-search-empty" role="status">No matching plugins.</p> : null}
    {filtered.map(record => {
        const selected = selectionMatchesRecord(selection, record);
        const enabled = record.desired ?? registry?.packages.get(record.manifest.id)?.desired ?? record.status !== 'off';
        return <div className="pe-workbench-package" key={workbenchPackageKey(record)} data-status={record.status}>
          <div className="pe-workbench-package-head" data-selected={selected}
            onContextMenu={onMove || onInspect ? event => { event.preventDefault(); event.stopPropagation(); void openMenu(record, event.currentTarget.querySelector<HTMLButtonElement>('.pe-workbench-package-select')!, event.clientX, event.clientY); } : undefined}>
            {onTogglePackage ? <SourceToggle name={`package ${record.manifest.name}`} enabled={enabled} status={record.status}
              onToggle={() => onTogglePackage(record.instanceId ?? record.manifest.id, !enabled)}
            /> : <span className="pe-workbench-tree-branch" aria-hidden="true" />}
            <button className="pe-workbench-package-select" type="button" aria-label={`Select package ${record.manifest.name}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelect(defaultSelection(record))}
              data-plugin-id={record.instanceId}
              title={onMove || onInspect ? 'Right-click for plugin options · Shift+F10' : undefined}
              aria-haspopup={onMove || onInspect ? 'menu' : undefined}
              onKeyDown={onMove || onInspect ? event => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                  event.preventDefault(); event.stopPropagation(); void openMenu(record, event.currentTarget);
                }
              } : undefined}>
              <span>
                <span className="pe-workbench-package-title"><strong>{record.manifest.name}</strong>{record.fresh ? <Badge>new</Badge> : null}</span>
                <small>{record.manifest.version} · {record.persistence}</small>
                {record.status !== 'active' ? <small className="pe-workbench-package-status">{record.status}</small> : null}
              </span>
            </button>
          </div>

        </div>;
      })}
  </nav>;
}

function sourceGroupLabel(kind: WorkbenchPackage['sourceKind'], label: string): string {
  if (kind === 'built-in') return 'Included with Power Eagle';
  if (kind === 'generated') return 'Created by Agent';
  if (kind === 'session') return 'Session only';
  return label;
}
