# Proposal

## Why

The revised Eagle host still speaks Saucepan 0.6 through hand-written commands and encrypted-token markers. Saucepan 0.9 and its TypeScript SDK provide the intended UUID claims, flat policies and retained immutable outputs, but Eagle's Node 16.17 host cannot simply use the SDK's default Node 22 transport.

## What Changes

- **BREAKING**: replace the 0.6 wire bridge, artifact response models and marker authentication with the current SDK client, source/output UUIDs and explicit application scopes. Do not retain a legacy protocol fallback or migrate encrypted Saucepan records.
- Bundle the SDK's transport-independent client with an injected Eagle transport; keep built-ins and browser preview usable when native tooling is unavailable.
- Preserve Git, URL and local inputs, persistent installation and session preview, static validation, provenance, and independent editable workspaces.
- Register immutable policy records and reference their UUIDs; keep credentials, keyring integrity, verification and restrictions independently opt-in.
- Pin exact immutable package outputs before using their paths. Validate and publish a replacement before retiring the prior revision; release only this consumer's pins after readers finish.
- Install SDK 0.2.0 from the published Saucepan v0.10.0 release with an explicit binary contract and isolated real-binary integration tests.
- Expose manager-owned profile preview and explicit immutable catalog registration with stage overrides. Preserve separate attachment/adoption and resource lifetimes; do not impose managed executable setup on package consumers.

## Capabilities

### New Capabilities

- `saucepan-integration`: SDK host transport, scoped acquisition, resource retention, failure handling and independent executable distribution.

### Modified Capabilities

None in the current main spec inventory. `rebuild-power-eagle` has an unarchived `package-distribution` delta requiring the old 0.6 bridge and token marker. This change replaces those Saucepan-specific contracts; its apply tasks must reconcile that pending delta before either change is archived, preserving unrelated package validation and release requirements. `add-plugin-spin-offs` remains responsible for local editable copies and namespace arbitration.

## Impact

Targets branch `revised`: `src/host/install/saucepan*.ts`, `package-repository.ts`, host transport/filesystem modules, package UI callers, workspace catalog provenance, tests, `package.json`/`package-lock.json`, Vite packaging and user documentation. No changes to Saucepan itself, no shared store reset, no automatic executable replacement, and no registry publishing or remote pushes. Planning only; existing unfinished changes are not marked complete.
