# External bridge compatibility

Power Eagle accepts minor and patch updates within a bridge's supported **numeric major**, including major zero. This is a deliberate project policy: SemVer itself does not promise stability for 0.x releases. Version acceptance still depends on the real command and response capabilities used by the adapter.

| Bridge | Accepted versions | Remaining checks |
| --- | --- | --- |
| Saucepan | Numeric major 0, at least 0.10.0 | Required resource/profile commands; public SDK response validation |
| Claude Code | Numeric major 2 | Model discovery and generation response validation |
| Codex CLI | Numeric major 0 | Model discovery and generation response validation |
| Eagle host/APIs | No invented version gate | Native module and callable API availability |

Build metadata is ignored in comparison. Prereleases are allowed within the supported numeric major, subject to semantic ordering against any minimum: Saucepan 0.10.0-rc.1 is too old, while 0.11.0-rc.1 is accepted. Claude/Codex have no newly imposed minimum. Their currently tested releases are evidence, not minimum-version pins. A major change requires adapter review before its protocol is used. Invalid version output is reported rather than coerced into a guessed version.

Local Agent discovery and generation each recheck the CLI version, even after a successful availability check. No error switches to another provider. Eagle generation remains delegated to the supplied host callback. Package manifest formats and declared dependency ranges retain their separate contracts.

Saucepan recovery distinguishes an unavailable Eagle Node bridge, executable startup failure, version incompatibility and missing commands. A same-major version never conceals a genuine command or protocol error. Startup is read-only and does not install binaries or initialize stores.

## SDK decision and test setup

Keep `saucepan-sdk` 0.2.0. The 0.11.0 SDK source adds managed setup/status and tagged self-update; the profile/resource API used here remains unchanged. The existing injected Eagle transport passes those operations on Node 16.17.1 with the published 0.11.0 Windows x64 manager. No Node or SDK upgrade is required for this change.

The isolated lifecycle harness uses a fresh manager root. Point `POWER_EAGLE_TEST_SAUCEPAN` at the **raw manager executable from the official release ZIP**, since a managed shim cannot find a managed installation in a fresh root. Production continues to use the public installed executable. This test setup does not inspect private manager metadata or modify the user's shared store.

```powershell
npm run build
$env:POWER_EAGLE_TEST_SAUCEPAN = 'C:\path\to\extracted-manager\saucepan.exe'
$env:POWER_EAGLE_TEST_NODE = 'C:\path\to\node16.17.1\node.exe'
node scripts/check-saucepan-host.mjs
node scripts/check-bridge-readiness.mjs
```

Real GUI acceptance for Saucepan 0.10 is recorded in [the Eagle host validation](saucepan-host-validation.md). Standalone Node acceptance for 0.11 does not establish a new GUI acceptance result or prove future releases; later same-major versions are accepted by policy.

## Acceptance on 2026-10-22

- `npm run build`: TypeScript, built-in artifacts, production browser bundle and CommonJS host bundle passed.
- `npm test`: 361 passed; 19 real-manager tests initially skipped without an explicit executable. Running those two suites with `POWER_EAGLE_TEST_SAUCEPAN` set to the raw 0.11.0 manager passed all 19 (380 tests passed across the runs).
- `node scripts/check-saucepan-host.mjs` under Node 16.17.1: read-only readiness, profile expansion/registration, installation, restart, failed replacement, concurrent-reader retention and explicit removal passed outside the checkout.
- `node scripts/check-bridge-readiness.mjs` under Node 16.17.1: the normal installed Saucepan shim reported `saucepan 0.11.0+v0.11.0`; selected Agent CLIs reported `2.1.308 (Claude Code)` and `codex-cli 0.162.0-alpha.17.2`. All passed read-only readiness. No new paid generation or GUI acceptance is claimed.
- `openspec validate support-forward-compatible-bridges --strict` and `git diff --check`: passed.
- Before committing, an isolated copy of the Git index passed TypeScript and all 62 helper/bridge tests. Its rebuilt CommonJS host bundle matched the staged bundle after normalizing dependency path labels, and both Node 16 acceptance scripts passed there. This verifies the commit independently of the remaining Agent UI work in the main checkout.

The raw manager came from the [official v0.11.0 release](https://github.com/ZackaryW/saucepan/releases/tag/v0.11.0). The Windows x64 ZIP SHA256 was verified against its published `SHA256SUMS`: `2e4ca74531dbd5b8374a2947ab3287b2353af192f860e6cdbe1fddd4ebe927c2`. Source comparison of v0.10.0 and v0.11.0 in `sdk/ts/src/client.ts` and `sdk/ts/src/contracts.ts` confirmed that the used resource/profile interfaces did not change. `package.json` and `package-lock.json` are unchanged.
