/**
 * Static parsing of the install/distribution manifests. A GitHub repo is
 * classified by which root files it has — `manifest.json` (a plugin) and/or
 * `marketplace.json` (a marketplace listing plugins). All parsing is pure and
 * code-free: it never executes plugin JS (activation does that elsewhere).
 */

/** A plugin's static package manifest (the install-time source of truth). */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  engine: string;
  main: string;
  description?: string;
  keywords?: string[];
}

/** Where a marketplace entry's plugin lives. */
export type PluginSource =
  | { type: 'local'; path: string }
  | { type: 'git'; url: string; ref?: string };

/** One plugin listed in a marketplace. */
export interface MarketplaceEntry {
  name: string;
  source: PluginSource;
  description?: string;
  category?: string;
}

/** A marketplace manifest. */
export interface Marketplace {
  name: string;
  displayName?: string;
  plugins: MarketplaceEntry[];
}

/** What a repo is, by the manifests present at its root. */
export function classifyRepo(rootEntries: string[]): { isPlugin: boolean; isMarketplace: boolean } {
  const isPlugin = rootEntries.includes('manifest.json');
  const isMarketplace = rootEntries.includes('marketplace.json');
  if (!isPlugin && !isMarketplace) {
    throw new Error('not a Power Eagle repo: no manifest.json or marketplace.json at root');
  }
  return { isPlugin, isMarketplace };
}

/** Require a non-empty string field, or throw. */
function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing or invalid '${key}'`);
  }
  return value;
}

/** Parse and validate a plugin manifest. */
export function parseManifest(raw: unknown): PluginManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('manifest: not an object');
  }
  const obj = raw as Record<string, unknown>;
  return {
    id: requireString(obj, 'id'),
    name: requireString(obj, 'name'),
    version: requireString(obj, 'version'),
    engine: requireString(obj, 'engine'),
    main: requireString(obj, 'main'),
    description: typeof obj.description === 'string' ? obj.description : undefined,
    keywords: Array.isArray(obj.keywords)
      ? obj.keywords.filter((k): k is string => typeof k === 'string')
      : undefined,
  };
}

/** Parse and validate one marketplace entry (resolving its source). */
function parseEntry(raw: unknown): MarketplaceEntry {
  if (!raw || typeof raw !== 'object') {
    throw new Error('marketplace entry: not an object');
  }
  const obj = raw as Record<string, unknown>;
  const src = obj.source;
  if (!src || typeof src !== 'object') {
    throw new Error('marketplace entry: missing source');
  }
  const s = src as Record<string, unknown>;
  const source: PluginSource =
    s.type === 'git'
      ? { type: 'git', url: requireString(s, 'url'), ref: typeof s.ref === 'string' ? s.ref : undefined }
      : { type: 'local', path: requireString(s, 'path') };

  return {
    name: requireString(obj, 'name'),
    source,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    category: typeof obj.category === 'string' ? obj.category : undefined,
  };
}

/** Parse and validate a marketplace manifest. */
export function parseMarketplace(raw: unknown): Marketplace {
  if (!raw || typeof raw !== 'object') {
    throw new Error('marketplace: not an object');
  }
  const obj = raw as Record<string, unknown>;
  const name = requireString(obj, 'name');
  if (!Array.isArray(obj.plugins)) {
    throw new Error("marketplace: missing 'plugins' array");
  }
  return {
    name,
    displayName: typeof obj.displayName === 'string' ? obj.displayName : undefined,
    plugins: obj.plugins.map(parseEntry),
  };
}
