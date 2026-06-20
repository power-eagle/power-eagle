# Filesystem Bridge

> Reaches `fs` / `path` / `os` in the Eagle plugin renderer, which has no module system but exposes `window.require`.

## Purpose

The plugin runs as bundled code inside Eagle's Electron renderer. A static
`import 'node:fs'` cannot be bundled for that target, but Eagle exposes Node's
`require` on `window`. This module centralizes that bridge so every host layer
(install/saucepan, eagle-host) reaches the filesystem one consistent way.

## Constraints

- Never statically `import` Node built-ins in host code that runs in the
  renderer — resolve them through this bridge (`window.require`, with a
  `Function('return require')` fallback). The saucepan adapter uses the same
  pattern for `child_process`.
- The bridge throws "module not available" when no runtime `require` exists, so
  higher layers that may run outside Eagle (e.g. plain Node unit tests) must
  inject fakes or tolerate the failure rather than assume fs is present.

## Key Invariants

- All host filesystem access goes through this module. In tests, stub
  `globalThis.window.require` to return the real Node modules (see
  `src/host/install/*.test.ts`).

## Scope Boundary

**Owns:** bridged `fs`/`path`/`os` primitives (exists, read/write, mkdir,
readdir, copy, remove, homedir, join).
**Does not own:** business logic, the saucepan store path layout, or saucepan's
own `child_process` bridge.
