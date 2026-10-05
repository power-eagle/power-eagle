import type { HostFilesystem } from './install/fs-bridge';
import { createHostFilesystem } from './install/fs-bridge';
import { optionalHostRequire } from './install/runtime-modules';
import { HostCapabilityError, hostOperation, unavailable } from './capability-error';
import { createEagleWebApi, type EagleWebApi } from './web-api';

export interface AssetRecord {
  id: string;
  name: string;
  extension: string;
  width: number;
  height: number;
  url: string;
  annotation: string;
  tags: string[];
  folderIds: string[];
  rating: number;
  fileUrl: string;
  thumbnailUrl: string;
  modifiedAt: number;
}

export interface FolderRecord {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  children: FolderRecord[];
}

export interface TagRecord {
  name: string;
  count: number;
  color: string;
  groups: string[];
}

export interface LibraryRecord {
  name: string;
  path: string;
  modificationTime: number;
}

export interface LibraryHistoryRecord {
  id: string;
  name: string;
  path: string;
  status: 'available' | 'missing' | 'inaccessible';
  reason?: string;
}

export interface AssetMetadataPatch {
  name?: string;
  annotation?: string;
  tags?: string[];
  folderIds?: string[];
  rating?: number;
}

export type FileCreationResult =
  | { status: 'cancelled' }
  | { status: 'created'; path: string };

interface EagleItemLike {
  id: string;
  name: string;
  ext: string;
  width: number;
  height: number;
  url: string;
  annotation: string;
  tags: string[];
  folders: string[];
  star: number;
  fileURL: string;
  thumbnailURL: string;
  modifiedAt: number;
  save(): Promise<boolean>;
}

interface EagleFolderLike {
  id: string;
  name: string;
  description: string;
  parent: string | null;
  children: EagleFolderLike[];
}

interface EagleTagLike { name: string; count: number; color: string; groups: string[] }
interface EagleLibraryLike { name?: string; path?: string; modificationTime?: number }

export interface EaglePluginHost {
  item?: {
    get(options?: Record<string, unknown>): Promise<EagleItemLike[]>;
    getById(id: string): Promise<EagleItemLike>;
    select(ids: string[]): Promise<boolean>;
    addFromPath(path: string, options?: Record<string, unknown>): Promise<string>;
    addFromURL(url: string, options?: Record<string, unknown>): Promise<string>;
  };
  folder?: {
    getAll(): Promise<EagleFolderLike[]>;
    open(id: string): Promise<void>;
  };
  tag?: { get(options?: { name?: string }): Promise<EagleTagLike[]> };
  library?: { info(): Promise<EagleLibraryLike> };
  clipboard?: { readText(): string; writeText(text: string): void };
  notification?: { show(message: { title: string; body: string }): Promise<void> };
  dialog?: {
    showOpenDialog?: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog?: (options: { title?: string; defaultPath?: string; buttonLabel?: string }) => Promise<{ canceled: boolean; filePath?: string }>;
  };
}

export interface EagleCapabilities {
  assets: {
    list(query?: Record<string, unknown>): Promise<AssetRecord[]>;
    select(ids: string[]): Promise<boolean>;
    updateMetadata(id: string, patch: AssetMetadataPatch): Promise<AssetRecord>;
    importPath(path: string, options?: Record<string, unknown>): Promise<string>;
    importUrl(url: string, options?: Record<string, unknown>): Promise<string>;
  };
  folders: { list(): Promise<FolderRecord[]>; open(id: string): Promise<void> };
  tags: { list(name?: string): Promise<TagRecord[]> };
  clipboard: { readText(): Promise<string>; writeText(text: string): Promise<void> };
  files: {
    inspect(path: string): Promise<{ path: string; status: 'directory' | 'file' | 'symbolic-link' | 'missing' }>;
    createText(suggestedName: string, content: string): Promise<FileCreationResult>;
  };
  library: {
    current(): Promise<LibraryRecord>;
    history(): Promise<LibraryHistoryRecord[]>;
    switch(path: string, signal?: AbortSignal): Promise<unknown>;
  };
  notify(message: { title: string; body?: string }): Promise<void>;
}

export interface EagleCapabilitySupport {
  pluginApi: boolean;
  nodeBridge: boolean;
  assets: boolean;
  folders: boolean;
  tags: boolean;
  library: boolean;
  clipboard: boolean;
  filePicker: boolean;
  saveDialog: boolean;
}

function required<T>(value: T | undefined, capability: 'eagle' | 'clipboard' | 'library' | 'filesystem', operation: string): T {
  if (value === undefined) throw unavailable(capability, operation);
  return value;
}

function assetRecord(item: EagleItemLike): AssetRecord {
  return {
    id: item.id, name: item.name, extension: item.ext, width: item.width, height: item.height,
    url: item.url, annotation: item.annotation, tags: [...item.tags], folderIds: [...item.folders],
    rating: item.star, fileUrl: item.fileURL, thumbnailUrl: item.thumbnailURL, modifiedAt: item.modifiedAt,
  };
}

function folderRecord(folder: EagleFolderLike): FolderRecord {
  return {
    id: folder.id, name: folder.name, description: folder.description, parentId: folder.parent,
    children: folder.children.map(folderRecord),
  };
}

function libraryName(path: string, filesystem: HostFilesystem): string {
  const base = filesystem.basename(path);
  return base.toLowerCase().endsWith('.library') ? base.slice(0, -'.library'.length) : base;
}

function historyRecord(path: string, index: number, filesystem: HostFilesystem): LibraryHistoryRecord {
  try {
    const kind = filesystem.kind(path);
    if (kind === 'directory') return { id: `library-${index}`, name: libraryName(path, filesystem), path, status: 'available' };
    if (kind === undefined) return { id: `library-${index}`, name: libraryName(path, filesystem), path, status: 'missing', reason: 'Directory does not exist' };
    return { id: `library-${index}`, name: libraryName(path, filesystem), path, status: 'missing', reason: `Expected a directory, found ${kind}` };
  } catch (error) {
    return {
      id: `library-${index}`, name: libraryName(path, filesystem), path, status: 'inaccessible',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Report actual host surface presence without invoking or mutating any Eagle operation. */
export function observeEagleCapabilities(
  host: Partial<EaglePluginHost> | undefined = (globalThis as unknown as { eagle?: EaglePluginHost }).eagle,
  nodeRequire: NodeRequire | undefined = optionalHostRequire(),
): EagleCapabilitySupport {
  return {
    pluginApi: Boolean(host),
    nodeBridge: typeof nodeRequire === 'function',
    assets: typeof host?.item?.get === 'function' && typeof host.item.getById === 'function',
    folders: typeof host?.folder?.getAll === 'function' && typeof host.folder.open === 'function',
    tags: typeof host?.tag?.get === 'function',
    library: typeof host?.library?.info === 'function',
    clipboard: typeof host?.clipboard?.readText === 'function' && typeof host.clipboard.writeText === 'function',
    filePicker: typeof host?.dialog?.showOpenDialog === 'function',
    saveDialog: typeof host?.dialog?.showSaveDialog === 'function',
  };
}

export function createEagleCapabilities(options: {
  host?: EaglePluginHost;
  filesystem?: HostFilesystem;
  webApi?: EagleWebApi;
  hostRequire?: NodeRequire;
} = {}): EagleCapabilities {
  const host = options.host ?? (globalThis as unknown as { eagle?: EaglePluginHost }).eagle;
  let filesystem = options.filesystem;
  const fs = () => filesystem ??= createHostFilesystem(options.hostRequire);
  const webApi = options.webApi ?? createEagleWebApi();

  return {
    assets: {
      list: query => hostOperation('eagle', 'assets.list', async () =>
        (await required(host?.item, 'eagle', 'assets.list').get(query)).map(assetRecord)),
      select: ids => hostOperation('eagle', 'assets.select', async () => {
        const result = await required(host?.item, 'eagle', 'assets.select').select(ids);
        if (!result) throw new HostCapabilityError('eagle', 'assets.select', 'failed', 'Eagle did not select the requested assets');
        return result;
      }),
      updateMetadata: (id, patch) => hostOperation('eagle', 'assets.updateMetadata', async () => {
        const item = await required(host?.item, 'eagle', 'assets.updateMetadata').getById(id);
        if (patch.name !== undefined) item.name = patch.name;
        if (patch.annotation !== undefined) item.annotation = patch.annotation;
        if (patch.tags !== undefined) item.tags = [...patch.tags];
        if (patch.folderIds !== undefined) item.folders = [...patch.folderIds];
        if (patch.rating !== undefined) item.star = patch.rating;
        const saved = await item.save();
        if (!saved) throw new HostCapabilityError('eagle', 'assets.updateMetadata', 'failed', `Eagle did not save asset ${id}`);
        return assetRecord(item);
      }),
      importPath: (path, importOptions) => hostOperation('eagle', 'assets.importPath', () =>
        required(host?.item, 'eagle', 'assets.importPath').addFromPath(path, importOptions)),
      importUrl: (url, importOptions) => hostOperation('eagle', 'assets.importUrl', () =>
        required(host?.item, 'eagle', 'assets.importUrl').addFromURL(url, importOptions)),
    },
    folders: {
      list: () => hostOperation('eagle', 'folders.list', async () =>
        (await required(host?.folder, 'eagle', 'folders.list').getAll()).map(folderRecord)),
      open: id => hostOperation('eagle', 'folders.open', () => required(host?.folder, 'eagle', 'folders.open').open(id)),
    },
    tags: {
      list: name => hostOperation('eagle', 'tags.list', async () =>
        (await required(host?.tag, 'eagle', 'tags.list').get(name ? { name } : undefined))
          .map(tag => ({ name: tag.name, count: tag.count, color: tag.color, groups: [...tag.groups] }))),
    },
    clipboard: {
      readText: () => hostOperation('clipboard', 'readText', () => required(host?.clipboard, 'clipboard', 'readText').readText()),
      writeText: text => hostOperation('clipboard', 'writeText', () => required(host?.clipboard, 'clipboard', 'writeText').writeText(text)),
    },
    files: {
      inspect: path => hostOperation('filesystem', 'inspect', () => {
        const kind = fs().kind(path);
        return { path, status: kind === undefined ? 'missing' : kind === 'other' ? 'file' : kind };
      }),
      createText: (suggestedName, content) => hostOperation('filesystem', 'createText', async () => {
        const save = required(host?.dialog?.showSaveDialog, 'filesystem', 'createText');
        const result = await save.call(host?.dialog, { title: 'Create file', defaultPath: suggestedName, buttonLabel: 'Create' });
        if (result.canceled) return { status: 'cancelled' };
        if (!result.filePath) throw new HostCapabilityError('filesystem', 'createText', 'invalid-result', 'Eagle save dialog returned no file path');
        fs().writeText(result.filePath, content);
        return { status: 'created', path: result.filePath };
      }),
    },
    library: {
      current: () => hostOperation('library', 'current', async () => {
        const info = await required(host?.library, 'library', 'current').info();
        if (typeof info.name !== 'string' || typeof info.path !== 'string') {
          throw new HostCapabilityError('library', 'current', 'invalid-result', 'Eagle library info omitted its name or path');
        }
        return { name: info.name, path: info.path, modificationTime: info.modificationTime ?? 0 };
      }),
      history: () => hostOperation('library', 'history', async () =>
        (await webApi.library.history()).map((path, index) => historyRecord(path, index, fs()))),
      switch: (path, signal) => hostOperation('library', 'switch', () => webApi.library.switch(path, signal)),
    },
    notify: message => hostOperation('eagle', 'notify', () =>
      required(host?.notification, 'eagle', 'notify').show({ title: message.title, body: message.body ?? '' })),
  };
}
