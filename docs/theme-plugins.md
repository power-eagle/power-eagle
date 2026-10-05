# Workbench theme plugins

Paper Pop ships enabled: warm paper, mint/gold/lavender panel headers, dark ink outlines, rounded controls, and offset shadows. Choose **Theme → Blueprint** in the top bar to return to the original appearance. The choice persists locally. Switching themes preserves the open tool's state.

Paper Pop appears in Sources as a styling-only package. Disabling its package or `paper` export removes its styling immediately and shows Blueprint. Re-enabling restores the remembered choice.

## Package contract

The source package lives in `src/plugins/paper-pop/`:

- `manifest.json` declares a styling contribution and its token schema.
- `tokens.json` contains CSS string values for the supported workbench tokens.
- `styling.ts` uses `defineStylingProvider` with tokens and empty variants/overrides.
- `power-eagle.build.json` builds the compiled provider as `styling.cjs`.

Run `npm run theme:build` to produce a standalone package in `.artifacts/paper-pop/`. It contains `manifest.json`, `styling.cjs`, and package metadata, with no runtime document or private dependencies. The built-in uses the same descriptor and implementation; the standalone artifact passes the normal discovery, provider-loading, activation, and composition contracts.

Shell theme exports explicitly declare `power-eagle/shell` in their `targets`. The host applies supported tokens as CSS custom properties on the workbench root. Runtime controls inherit them; the theme does not inject global styles or replace widgets. Supported token names are defined in `src/app/workbench-theme.ts`; `tokens.json` demonstrates colors, typography, outlines, radii, shadows, backgrounds, and panel headers. Panel dimensions and scrolling are host layout decisions.

The current picker registers the bundled Paper Pop package. The standalone package is ready for the provider loader; adding arbitrary acquired packages to the application's live catalog belongs to the remaining acquisition integration, not this theme slice.

Theme preference storage uses `power-eagle.theme.v1` with a versioned JSON envelope. If preference storage fails, the chosen theme still applies for the current session and the UI explains that it could not save the choice.
