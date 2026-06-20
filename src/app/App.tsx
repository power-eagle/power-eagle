import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { BuiltinPluginView } from './builtin-plugin-view';
import { initHostService, buildHostContext, type HostService, type HostContext, type PluginSummary } from './host-service';
import { createEagleHost, defaultEagleHostDeps } from './eagle-host';
import { loadTheme } from './theme-store';
import { ThemeContext } from '../sdui/render/render';
import { EMPTY_THEME, mergeThemes } from '../sdui/theme';
import { listBuiltinModules } from '../plugins/builtins';
import type { EagleHost } from '../plugins/eagle';
import type { Theme } from '../sdui/types';

const EMPTY_CONTEXT: HostContext = { services: {}, widgets: {}, theme: EMPTY_THEME, contributions: {} };

const DISABLED_KEY = 'peagle.disabled.v1';

/** Load the set of disabled plugin ids from localStorage (empty on any failure). */
function loadDisabled(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const ids = JSON.parse(window.localStorage.getItem(DISABLED_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Persist the set of disabled plugin ids to localStorage. */
function saveDisabled(ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISABLED_KEY, JSON.stringify([...ids]));
  } catch {
    // persistence is best-effort
  }
}

// Plugin tabs split by source (builtin = bundled, any kind) and by kind for the
// rest (app = installed visual, service, styling); buckets/install manage
// adding plugins through the saucepan-backed host service.
type HostTab = 'builtin' | 'app' | 'service' | 'styling' | 'buckets' | 'install';
const PLUGIN_TABS: HostTab[] = ['builtin', 'app', 'service', 'styling'];
const TABS: HostTab[] = [...PLUGIN_TABS, 'buckets', 'install'];

interface HostEvent {
  id: number;
  title: string;
  body?: string;
}

/** Does a plugin belong in the given tab? builtin = bundled (any kind); the rest group installed by kind. */
function inTab(plugin: PluginSummary, tab: HostTab): boolean {
  if (tab === 'builtin') return plugin.source === 'builtin';
  if (tab === 'app') return plugin.source !== 'builtin' && plugin.kind === 'visual';
  return plugin.source !== 'builtin' && plugin.kind === tab;
}

/**
 * The v3 host shell. Plugins are listed in four tabs (builtin / app / service /
 * styling); a visual plugin launches into the registry-driven renderer, while
 * service and styling plugins run in the background and contribute their
 * surfaces / widgets / theme to every launched plugin.
 */
export function App(props: { service?: HostService; eagle?: EagleHost; theme?: Theme }): JSX.Element {
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [theme, setTheme] = useState<Theme>(props.theme ?? EMPTY_THEME);
  const eagle = useMemo<EagleHost>(
    () =>
      props.eagle ??
      createEagleHost(
        defaultEagleHostDeps((message) =>
          setEvents((current) => [{ id: current.length, ...message }, ...current].slice(0, 20)),
        ),
      ),
    [props.eagle],
  );

  const [context, setContext] = useState<HostContext>(EMPTY_CONTEXT);
  const [service, setService] = useState<HostService | null>(props.service ?? null);
  const [tab, setTab] = useState<HostTab>('builtin');
  const [available, setAvailable] = useState<PluginSummary[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Enable state persists across reloads via localStorage (disabled plugin ids).
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(loadDisabled);
  const [filter, setFilter] = useState('');
  const [bucketInput, setBucketInput] = useState('');
  const [installInput, setInstallInput] = useState('');

  useEffect(() => {
    if (props.service) return;
    let active = true;
    void initHostService().then((resolved) => {
      if (active) setService(resolved);
    });
    return () => {
      active = false;
    };
  }, [props.service]);

  useEffect(() => {
    if (service) {
      setAvailable(service.listAvailable());
      setBuckets(service.listBuckets());
    }
  }, [service]);

  useEffect(() => {
    if (!props.theme) setTheme(loadTheme());
  }, [props.theme]);

  useEffect(() => {
    saveDisabled(disabled);
  }, [disabled]);

  // Activate the enabled service + styling plugins; their surfaces/widgets/theme
  // become the shared context every launched visual plugin runs against.
  // Disabled plugins are excluded, so the context rebuilds when a toggle flips.
  useEffect(() => {
    let active = true;
    const modules = listBuiltinModules().filter((module) => !disabled.has(module.manifest.id));
    void buildHostContext(modules, eagle as unknown as Record<string, unknown>).then((built) => {
      if (active) setContext(built);
    });
    return () => {
      active = false;
    };
  }, [eagle, disabled]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  function toggle(id: string): void {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** A service/styling plugin's overview: what it provides. */
  function renderOverview(plugin: PluginSummary): JSX.Element {
    const contribution = context.contributions[plugin.id];
    if (plugin.kind === 'service') {
      return (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">{plugin.name} · service</div>
          <div className="text-xs text-muted-foreground">methods: {contribution?.services?.methods.join(', ') || '—'}</div>
          <div className="text-xs text-muted-foreground">objects/vars: {contribution?.services?.vars.join(', ') || '—'}</div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">{plugin.name} · styling</div>
        <div className="text-xs text-muted-foreground">widget types: {contribution?.widgets?.join(', ') || '—'}</div>
        <div className="text-xs text-muted-foreground">theme: {contribution?.theme ? 'yes' : 'no'}</div>
      </div>
    );
  }

  function refresh(): void {
    if (!service) return;
    setAvailable(service.listAvailable());
    setBuckets(service.listBuckets());
  }

  function handleAddBucket(): void {
    if (!service || !bucketInput.trim()) return;
    service.addBucket(bucketInput.trim());
    setBucketInput('');
    refresh();
  }

  function handleInstall(): void {
    if (!service || !installInput.trim()) return;
    service.install(installInput.trim());
    setInstallInput('');
    refresh();
  }

  const isPluginTab = PLUGIN_TABS.includes(tab);
  const needle = filter.trim().toLowerCase();
  const visible = available.filter(
    (plugin) => inTab(plugin, tab) && (!needle || plugin.name.toLowerCase().includes(needle)),
  );
  const selected = available.find((plugin) => plugin.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <section className="relative mx-auto flex min-h-[720px] max-w-7xl overflow-hidden rounded-[24px] border border-border/80 bg-card/95 shadow-[0_24px_70px_hsl(var(--foreground)/0.12)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:px-5">
            <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">
              power<span className="font-medium text-muted-foreground">eagle</span>
              <Badge className="ml-2 rounded-md px-2 py-0.5 text-[10px] font-medium" variant="outline">v3</Badge>
            </div>
            <Tabs className="ml-auto" onValueChange={(value) => setTab(value as HostTab)} value={tab}>
              <TabsList>
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name}>{name}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {service ? null : <span className="text-xs">initializing saucepan...</span>}
          </header>
          <div className="flex min-h-0 flex-1">
            {isPluginTab ? (
              <aside className="flex w-[248px] flex-shrink-0 flex-col border-r border-border bg-muted/25">
                <div className="border-b border-border p-3">
                  <Input
                    className="w-full"
                    placeholder={`filter ${tab}...`}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2 text-sm">
                  {visible.length ? visible.map((plugin) => {
                    const isOff = disabled.has(plugin.id);
                    return (
                      <div
                        key={plugin.id}
                        className={`mb-1.5 flex items-stretch gap-1 rounded-xl border transition-colors ${selectedId === plugin.id ? 'border-border bg-card shadow-sm' : 'border-transparent hover:bg-card hover:shadow-sm'} ${isOff ? 'opacity-50' : ''}`}
                      >
                        <button className="flex flex-1 flex-col px-3 py-3 text-left" onClick={() => setSelectedId(plugin.id)} type="button">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span className="font-medium">{plugin.name}</span>
                            <Badge className="rounded-md px-2 py-0.5 text-[10px] font-medium" variant="outline">{plugin.kind}</Badge>
                          </span>
                          <span className="mt-1 text-xs text-muted-foreground">{plugin.id} · v{plugin.version} · {plugin.source}</span>
                          {plugin.kind !== 'visual' ? <span className="mt-1 text-[10px] text-muted-foreground/80">background — contributes {plugin.kind === 'service' ? 'methods/objects' : 'widgets/theme'}</span> : null}
                        </button>
                        <button
                          className="flex-shrink-0 rounded-r-xl px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => toggle(plugin.id)}
                          type="button"
                          aria-pressed={!isOff}
                          title={isOff ? 'enable' : 'disable'}
                        >
                          {isOff ? 'off' : 'on'}
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground">no {tab} plugins</div>
                  )}
                </div>
              </aside>
            ) : null}
            <section className="min-w-0 flex-1 overflow-y-auto bg-background/70 p-4 md:p-5">
              {isPluginTab ? (
                !selected ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">select a plugin</div>
                ) : disabled.has(selected.id) ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {selected.name} is disabled — enable it to {selected.kind === 'visual' ? 'launch' : 'see what it provides'}
                  </div>
                ) : selected.kind === 'visual' ? (
                  selected.launchable ? (
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <ThemeContext.Provider value={mergeThemes(context.theme, theme)}>
                        <BuiltinPluginView
                          pluginId={selected.id}
                          eagle={eagle as unknown as Record<string, unknown>}
                          services={context.services}
                          widgets={context.widgets}
                        />
                      </ThemeContext.Provider>
                    </div>
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">{selected.name} is installed — launching installed plugins is not supported yet</div>
                  )
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">{renderOverview(selected)}</div>
                )
              ) : null}
              {tab === 'buckets' ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input className="flex-1" placeholder="bucket path or file:// url" value={bucketInput} onChange={(event) => setBucketInput(event.target.value)} />
                    <Button onClick={handleAddBucket} type="button">add bucket</Button>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {buckets.length ? buckets.map((url) => (
                      <li key={url} className="rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground">{url}</li>
                    )) : <li className="px-3 py-4 text-muted-foreground">no buckets registered</li>}
                  </ul>
                </div>
              ) : null}
              {tab === 'install' ? (
                <div className="flex gap-2">
                  <Input className="flex-1" placeholder="owner/repo to install" value={installInput} onChange={(event) => setInstallInput(event.target.value)} />
                  <Button onClick={handleInstall} type="button">install</Button>
                </div>
              ) : null}
            </section>
          </div>
        </div>
        <aside className="hidden w-[260px] flex-shrink-0 flex-col border-l border-border bg-muted/25 lg:flex">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">inspector</div>
          <div className="flex-1 overflow-y-auto p-3 text-xs text-muted-foreground">
            {events.length ? events.map((event) => (
              <div key={event.id} className="mb-2 rounded-lg border border-border bg-card px-3 py-2">
                <div className="font-medium text-foreground">{event.title}</div>
                {event.body ? <div className="mt-0.5">{event.body}</div> : null}
              </div>
            )) : <div className="px-1 py-2">no host events yet</div>}
          </div>
        </aside>
      </section>
    </main>
  );
}
