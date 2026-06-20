/**
 * The real EagleHost adapter: implements the typed host contract the bundled v3
 * plugins call (createFile / getRecentLibraries / switchLibrary / notify) on top
 * of small injectable host primitives. createEagleHost is pure and testable;
 * defaultEagleHostDeps wires the actual Eagle global + fs bridge at the host.
 */
import type { EagleHost } from '../plugins/eagle';
import { joinPath, homeDir, readTextFile, writeTextFile } from '../host/install/fs-bridge';

/** The host primitives the adapter composes into an EagleHost. */
export interface EagleHostDeps {
  notifySink(message: { title: string; body?: string }): void;
  switchLibrary(path: string): Promise<void> | void;
  readSettings(): string;
  chooseSavePath(suggestedName: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void> | void;
}

/** Compose host primitives into the EagleHost the v3 plugins consume. */
export function createEagleHost(deps: EagleHostDeps): EagleHost {
  return {
    notify: (message) => deps.notifySink(message),
    switchLibrary: (path) => deps.switchLibrary(path),
    getRecentLibraries: () => {
      try {
        const settings = JSON.parse(deps.readSettings()) as { libraryHistory?: unknown };
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

interface EagleGlobal {
  notification?: { show(message: { title: string; description?: string; body?: string }): void };
  library?: { switch(path: string): Promise<void> | void };
  dialog?: { showSaveDialog(options: { defaultPath?: string }): Promise<{ canceled: boolean; filePath?: string }> };
}

/** The Eagle settings file path for the current platform. */
function eagleSettingsPath(): string {
  const appData = typeof process !== 'undefined' ? process.env.APPDATA : undefined;
  const base = appData ?? joinPath(homeDir(), 'Library', 'Application Support');
  return joinPath(base, 'eagle', 'Settings');
}

/** Wire the host primitives to the real Eagle runtime + fs bridge. */
export function defaultEagleHostDeps(recordEvent: (message: { title: string; body?: string }) => void): EagleHostDeps {
  const eagleGlobal = (typeof eagle !== 'undefined' ? eagle : undefined) as EagleGlobal | undefined;
  return {
    notifySink: (message) => {
      recordEvent(message);
      eagleGlobal?.notification?.show({ title: message.title, description: message.body });
    },
    switchLibrary: (path) => eagleGlobal?.library?.switch(path),
    readSettings: () => readTextFile(eagleSettingsPath()),
    chooseSavePath: async (suggestedName) => {
      const result = await eagleGlobal?.dialog?.showSaveDialog({ defaultPath: suggestedName });
      return result && !result.canceled ? result.filePath ?? null : null;
    },
    writeFile: (path, content) => writeTextFile(path, content),
  };
}
