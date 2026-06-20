/**
 * The real EagleHost adapter: implements the typed host contract the bundled v3
 * plugins call (createFile / getRecentLibraries / switchLibrary / notify) on top
 * of small injectable host primitives. createEagleHost is pure and testable;
 * defaultEagleHostDeps wires the actual Eagle global + fs bridge at the host.
 */
import type { EagleHost } from '../plugins/eagle';
import { joinPath, readTextFile, writeTextFile } from '../host/install/fs-bridge';

/** The host primitives the adapter composes into an EagleHost. */
export interface EagleHostDeps {
  notifySink(message: { title: string; body?: string }): void;
  switchLibrary(path: string): Promise<void> | void;
  readSettings(): Promise<string> | string;
  chooseSavePath(suggestedName: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void> | void;
}

/** Compose host primitives into the EagleHost the v3 plugins consume. */
export function createEagleHost(deps: EagleHostDeps): EagleHost {
  return {
    notify: (message) => deps.notifySink(message),
    switchLibrary: (path) => deps.switchLibrary(path),
    getRecentLibraries: async () => {
      try {
        const settings = JSON.parse(await deps.readSettings()) as { libraryHistory?: unknown };
        return Array.isArray(settings.libraryHistory)
          ? settings.libraryHistory.filter((entry): entry is string => typeof entry === 'string')
          : [];
      } catch {
        return [];
      }
    },
    createFile: async ({ fileName, extension, content }) => {
      const target = await deps.chooseSavePath(`${fileName}.${extension}`);
      if (!target) {
        return false;
      }
      await deps.writeFile(target, content);
      return true;
    },
  };
}

/** Wire the host primitives to the injected Eagle global + fs bridge. */
export function defaultEagleHostDeps(recordEvent: (message: { title: string; body?: string }) => void): EagleHostDeps {
  return {
    notifySink: (message) => {
      recordEvent(message);
      void eagle.notification.show({ title: message.title, body: message.body ?? '' });
    },
    switchLibrary: (path) => recordEvent({ title: 'Switch Library', body: path }),
    // Eagle exposes no recent-libraries API; read libraryHistory from its Settings
    // file, located via the injected eagle global (not the unreliable node process).
    readSettings: async () => {
      const appData = await eagle.app.getPath('appData');
      return readTextFile(joinPath(appData, 'eagle', 'Settings'));
    },
    chooseSavePath: async (suggestedName) => {
      const result = await eagle.dialog.showSaveDialog({ defaultPath: suggestedName });
      return result.canceled ? null : result.filePath ?? null;
    },
    writeFile: (path, content) => writeTextFile(path, content),
  };
}
