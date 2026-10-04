# Compiled provider host experiment

## Status: provider fixture execution pending

The isolated fixture builds and all three Node tests pass. **The compiled-provider architecture has not yet been verified in Eagle.** Do not begin dependent loader/activation integration or treat the Node results as host evidence.

Observed on 2026-10-03, Windows x64:

- Installed Eagle: `4.0.0`, resource metadata build `20260401`, build number `23`.
- Test runner: Node `26.8.2`; this is not Eagle's embedded Node version.
- Automated launches with a remote-debugging flag exited during startup with decimal `-1073741819` (`0xC0000005`, access violation), including a retry with `--disable-gpu`. This did not establish normal-launch behavior.
- On 2026-10-03 the user confirmed a normal Eagle launch and supplied a screenshot of the revised root plugin rendering inside Eagle 4.0.0. Eagle also reported that `_locales/en.json` was missing; the localization resource and a regression check have since been restored.
- The shell sets `ELECTRON_RUN_AS_NODE=1`. Automated child launches removed it without changing the global environment.
- Embedded Electron/Node/Chromium versions, the provider fixture, and plugin module-bridge availability remain **unobserved**. The installed resource manifest's Electron development dependency is not runtime evidence.

No fixture was installed into the live package store and no library/package data was edited. Startup used the installed Eagle executable; fixture output and all intentional experiment writes remain in `.artifacts` or an isolated temporary test directory.

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

## Gate

Task 1.1 remains incomplete until the isolated provider fixture itself is launched; the root application launch does confirm Eagle can host the revised Vite/React output. Task 1.3 remains incomplete. Task 1.2 has Node/artifact evidence. Task 1.4 records current observations but remains incomplete until the provider report exists. Independent language/schema and presentation work may continue; production compiled-provider integration must wait.
