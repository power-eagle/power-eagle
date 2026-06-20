/**
 * Load the user's global theme from ~/.powereagle/theme.json. Dropping a
 * different theme.json there restyles every plugin with no code change. Any
 * read/parse failure (missing file, bad json, no fs bridge) falls back to the
 * empty theme so defaults apply.
 */
import { joinPath, homeDir, pathExists, readTextFile } from '../host/install/fs-bridge';
import { EMPTY_THEME } from '../sdui/theme';
import type { Theme } from '../sdui/types';

/** Path to the user's global theme file under the powereagle home. */
export function resolveThemePath(root?: string): string {
  return joinPath(root ?? joinPath(homeDir(), '.powereagle'), 'theme.json');
}

/** Read the global theme, or the empty theme when absent/unreadable. */
export function loadTheme(root?: string): Theme {
  try {
    const path = resolveThemePath(root);
    if (!pathExists(path)) {
      return EMPTY_THEME;
    }
    return JSON.parse(readTextFile(path)) as Theme;
  } catch {
    return EMPTY_THEME;
  }
}
