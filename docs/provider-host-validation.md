# Compiled provider host experiment

## Status: passed in Eagle

The isolated fixture builds, all three Node tests pass, and all 14 host checks passed in Eagle on 2026-10-04. This verifies the initial CommonJS provider, package-local dependency, shared React, asset, lifecycle, and cache-reload approach for production integration.

Observed on 2026-10-03, Windows x64:

- Eagle `4.0.0`, build `23`, on Windows x64.
- Embedded runtime: Electron `22.3.7`, Node `16.17.1`, Chromium `108.0.5359.215`, V8 `10.8.168.25-electron.0`, Node modules ABI `110`, and N-API `8`.
- The host exposed both the Eagle API and Node `require`. `onPluginCreate` supplied the local repository through `PluginContext.path`; plugin documents use the non-file `eagleplugin:` URL scheme.
- Test runner: Node `26.8.2`; this remains separate from the embedded runtime above.
- Automated launches with a remote-debugging flag exited during startup with decimal `-1073741819` (`0xC0000005`, access violation), including a retry with `--disable-gpu`. This did not establish normal-launch behavior.
- On 2026-10-03 the user confirmed a normal Eagle launch and supplied a screenshot of the revised root plugin rendering inside Eagle 4.0.0. Eagle also reported that `_locales/en.json` was missing; the localization resource and a regression check have since been restored.
- The shell sets `ELECTRON_RUN_AS_NODE=1`. Automated child launches removed it without changing the global environment.
- The root application ran the fixture from `.artifacts/provider-host` without importing a second plugin or modifying the live Power Eagle package store.

No fixture was installed into the live package store and no library/package data was edited. Startup used the installed Eagle executable; fixture output and all intentional experiment writes remain in `.artifacts` or an isolated temporary test directory. The retained report is `.artifacts/provider-host/result.json`.

## Reproduce

1. Run `npm ci`, then `npm run fixture:check` and `npm run fixture:eagle` from this repository.
2. Launch the normal revised Power Eagle development plugin that uses the root `manifest.json`.
3. The **Compiled provider host experiment** runs automatically in the working app; **Run provider checks** repeats it.
4. Inspect its visible report and `.artifacts/provider-host/result.json`. Retain a successful report before completing checkpoint 1.3.

The separately importable `.artifacts/provider-host/manifest.json` remains available when isolation from the main app is useful, but it is no longer required to gather the host evidence.

The fixture deliberately does not use the reference repository or `~/.powereagle`. It has its own Eagle plugin id. Rebuild before importing after code changes.

## What the artifact tests

Two explicit CommonJS widget providers bundle Radix Switch but receive React, ReactDOM, and JSX runtime through a factory-scoped import mapping. Each ships a physical private `node_modules/clsx`: alpha `1.2.1`, beta `2.1.1`. No global Node resolver is patched. Assets resolve through canonical package paths to file URLs. This is an experiment, not the final public manifest/SDK implementation.

Node tests copy both packages outside the repository and verify package-local resolution, host runtime identities, server rendering of the hook-using widget, escaping-path rejection, and changed-code reload without replacing the other package's dependency instance. These do not establish interactive rendering or Eagle support.

The Eagle harness records actual runtime versions, exercises a real switch click, decodes the packaged image, unmounts and re-enables the widget, checks listener disposal, replaces provider code, and verifies an unrelated cached dependency survives. It restores the changed fixture entry even after failure. Browser previews report that Eagle is required.

## Host results

All 14 checks passed: fixture discovery, runtime JSON selection, two private `clsx` versions, package-owned resolution paths, React/ReactDOM/JSX identity, a hook-using Radix switch render and click, package-relative image decoding, disable/re-enable cleanup, changed-code reload, unrelated dependency-cache retention, and balanced mount/disposal events.

The checkpoint-one gate is satisfied for the tested Eagle/runtime/platform combination. Production compiled-provider integration may use the verified package-anchored CommonJS factory and host-injected shared-runtime approach. Other Eagle/runtime/platform combinations still require compatibility diagnostics rather than assumed support.
