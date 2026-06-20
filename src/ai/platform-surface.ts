/**
 * The Eagle platform surface handed to the model so a generated plugin can use
 * what it actually runs on. Generated code executes inside the Eagle webview,
 * where the `eagle` object is a global (no import needed) and the local Eagle
 * Web API is reachable over HTTP — so both are genuinely available. The eagle
 * type surface is the real eagle.d.ts, embedded verbatim at build time.
 */
import eagleApiTypes from '../eagle.d.ts?raw';

/** The injected `eagle` global surface (the real eagle.d.ts), embedded verbatim. */
export const eagleSurface = [
  'Platform: your plugin runs inside Eagle. The `eagle` object is a runtime GLOBAL — use it directly without importing (e.g. eagle.item, eagle.folder, eagle.notification, eagle.clipboard, eagle.app). Its full TypeScript surface:',
  '```ts',
  eagleApiTypes.trim(),
  '```',
].join('\n');

/** The Eagle local Web API surface (reachable over HTTP from the webview). */
export const webApiSurface = `Eagle Web API (HTTP at http://localhost:41595/api; developer token from /application/info, passed as ?token=):
- library.info() — info about the active library
- library.history() — recently opened library paths
- library.switch(libraryPath) — switch the active library`;
