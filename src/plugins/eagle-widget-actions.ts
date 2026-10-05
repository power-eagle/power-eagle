import type { EagleCapabilities, FolderRecord } from '../host/eagle-capabilities';
import {
  assetRecordSchema, folderListSchema, importRequestListSchema, importResultListSchema,
  libraryHistoryListSchema, metadataSubmissionSchema, tagListSchema,
} from '../sdui/authoring/eagle';
import type { CallableAdapter } from '../sdui/runtime/actions';
import type { Json, PackageManifest } from '../sdui/schema/model';

export const EAGLE_WIDGET_ACTIONS_ID = 'power-eagle.eagle-actions';
const target = (id: string) => `${EAGLE_WIDGET_ACTIONS_ID}/${id}`;
const string = { type: 'string' as const, minLength: 1 };

export interface FolderNodeRecord { id: string; name: string; description: string; parentId: string }
export interface ImportRequest { id: string; source: string; kind: 'path' | 'url' }
export interface ImportResult extends ImportRequest {
  status: 'queued' | 'importing' | 'success' | 'error' | 'cancelled';
  assetId: string;
  message: string;
}

export function flattenFolders(folders: readonly FolderRecord[]): FolderNodeRecord[] {
  const result: FolderNodeRecord[] = [];
  const seen = new Set<string>();
  const visit = (folder: FolderRecord, inheritedParent: string) => {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    result.push({
      id: folder.id, name: folder.name, description: folder.description,
      parentId: folder.parentId ?? inheritedParent,
    });
    folder.children.forEach(child => visit(child, folder.id));
  };
  folders.forEach(folder => visit(folder, ''));
  return result;
}

function object(value: Json): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object arguments');
  return value;
}

function strings(value: Json | undefined): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('Expected a string array');
  return value as string[];
}

function importRequests(value: Json): ImportRequest[] {
  if (!Array.isArray(value)) throw new Error('Expected import requests');
  return value.map(raw => {
    const item = object(raw);
    return { id: String(item.id), source: String(item.source), kind: item.kind === 'url' ? 'url' : 'path' };
  });
}

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Eagle operation scope was disposed', 'AbortError');
}

export function eagleWidgetCalls(capabilities: EagleCapabilities): Readonly<Record<string, CallableAdapter>> {
  return {
    [target('folders')]: {
      input: { type: 'null' }, output: folderListSchema,
      invoke: async (_args, context) => {
        const folders = await capabilities.folders.list();
        assertActive(context.signal);
        return flattenFolders(folders) as unknown as Json;
      },
    },
    [target('openFolder')]: {
      input: string, output: { type: 'null' },
      invoke: async (id, context) => {
        await capabilities.folders.open(String(id));
        assertActive(context.signal);
        return null;
      },
    },
    [target('tags')]: {
      input: { type: 'string' }, output: tagListSchema,
      invoke: async (name, context) => {
        const tags = await capabilities.tags.list(String(name) || undefined);
        assertActive(context.signal);
        return tags as unknown as Json;
      },
    },
    [target('libraries')]: {
      input: { type: 'null' }, output: libraryHistoryListSchema,
      invoke: async (_args, context) => {
        const libraries = await capabilities.library.history();
        assertActive(context.signal);
        return libraries.map(item => ({ ...item, reason: item.reason ?? '' })) as unknown as Json;
      },
    },
    [target('switchLibrary')]: {
      input: string, output: { type: 'json' },
      invoke: async (path, context) => {
        const result = await capabilities.library.switch(String(path), context.signal);
        assertActive(context.signal);
        return result === undefined ? null : result as Json;
      },
    },
    [target('updateMetadata')]: {
      input: metadataSubmissionSchema, output: assetRecordSchema,
      invoke: async (args, context) => {
        const input = object(args);
        const updated = await capabilities.assets.updateMetadata(String(input.id), {
          name: String(input.name), annotation: String(input.annotation), tags: strings(input.tags),
          folderIds: strings(input.folderIds), rating: Number(input.rating),
        });
        assertActive(context.signal);
        return updated as unknown as Json;
      },
    },
    [target('importMany')]: {
      input: importRequestListSchema, output: importResultListSchema,
      invoke: async (args, context) => {
        const requests = importRequests(args);
        const results = await Promise.all(requests.map(async (request): Promise<ImportResult> => {
          try {
            const assetId = request.kind === 'url'
              ? await capabilities.assets.importUrl(request.source)
              : await capabilities.assets.importPath(request.source);
            return { ...request, status: 'success', assetId, message: '' };
          } catch (error) {
            return {
              ...request, status: 'error', assetId: '',
              message: error instanceof Error ? error.message : String(error),
            };
          }
        }));
        assertActive(context.signal);
        return results as unknown as Json;
      },
    },
  };
}

export const eagleWidgetActionManifest: PackageManifest = {
  format: 'power-eagle/package', formatVersion: 1, id: EAGLE_WIDGET_ACTIONS_ID,
  name: 'Eagle Widget Actions', version: '1.0.0',
  description: 'Typed Eagle action exports used by declarative Eagle widgets.', sdk: '^1.0.0',
  contributions: { actions: 'actions.cjs' },
  exports: [
    { kind: 'action', id: 'folders', contract: { input: { type: 'null' }, output: folderListSchema } },
    { kind: 'action', id: 'openFolder', contract: { input: string, output: { type: 'null' } } },
    { kind: 'action', id: 'tags', contract: { input: { type: 'string' }, output: tagListSchema } },
    { kind: 'action', id: 'libraries', contract: { input: { type: 'null' }, output: libraryHistoryListSchema } },
    { kind: 'action', id: 'switchLibrary', contract: { input: string, output: { type: 'json' } } },
    { kind: 'action', id: 'updateMetadata', contract: { input: metadataSubmissionSchema, output: assetRecordSchema } },
    { kind: 'action', id: 'importMany', contract: { input: importRequestListSchema, output: importResultListSchema } },
  ],
  dependencies: [], assets: [],
};
