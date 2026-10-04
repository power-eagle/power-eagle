# Proposal

## Why

Power Eagle needs a coherent extensible language and workbench rather than the current small, executable v3 widget grammar and tabbed shell. The new design scaffold and a deliberately breaking rebuild make it possible to adopt Stac's typed-authoring, serializable-document, registry-and-parser architecture while retaining the project's useful source organization and installation infrastructure.

## What Changes

- **BREAKING:** Introduce a new versioned language: TypeScript authoring produces validated JSON with composable widgets, bindings, and declarative actions. Reject old v2/v3 formats; provide no compatibility adapters, legacy execution paths, or automatic conversion.
- **BREAKING:** Replace mutually exclusive plugin kinds and the single module entry with optional manifest-declared contributions: `run.json`, `types.cjs`, `styling.cjs`, and action/service modules. Packages may include any supported combination and ship production `node_modules` and assets.
- Add named exports, explicit cross-package dependencies, per-export enablement, lifecycle cleanup, and deterministic registry/style resolution. Verify plugin-local dependency loading and shared React inside Eagle before dependent implementation.
- Expand the widget catalog across layout, forms, collections, media, desktop interactions, and Eagle assets; give every supported type a schema, behavioral contract, and documentation.
- Rebuild the shell from the supplied dark blueprint design system: Sources, Stage, and Agent share one selection; start a clean new-format AI history with version refinement using the new document contract.
- Preserve the source module boundaries while replacing the legacy Power Eagle data layout with Saucepan's current shared central-store protocol. Re-author useful Eagle tools and restore an Eagle release package rather than restoring legacy runtime behavior.

## Capabilities

### New Capabilities

- `declarative-language`: Typed authoring, canonical documents, validation, bindings, state, rendering, and action execution.
- `contribution-packages`: Composable manifest entries, compiled providers, bundled dependencies, assets, and extension SDK.
- `contribution-activation`: Named exports, dependency resolution, enablement, registry changes, styling precedence, and cleanup.
- `widget-catalog`: Expanded built-in widget vocabulary, common contracts, accessibility, and catalog discovery.
- `package-distribution`: Legacy-data reset, current Saucepan acquisition and discovery, package validation, and host release packaging.
- `workbench-shell`: Design-system-based panels, source tree, stage, activation inspection, and unified selection.
- `ai-authoring`: Registry-aware generation, validation, persistent conversations, and version refinement.
- `eagle-tooling`: Eagle adapters and re-authored File Creator, Recent Libraries, clipboard, and extension examples.

### Modified Capabilities

None. The target currently has no durable OpenSpec capability specs.

## Impact

- Implementation target: `C:/Users/ZackaryW/Desktop/+workplace/power-eagle-revised`.
- Read-only behavior/source reference: sibling `power-eagle` at inspected commit `2f3accf`; visual reference: sibling `power-eagle-design-system`.
- Retain `src/app`, `src/sdui`, `src/host/install`, `src/plugins`, `src/ai`, and `src/components/ui`, with focused internal additions. Preserve `docs`, `examples`, BDD features, and colocated unit-test conventions.
- Clear the legacy Power Eagle-owned `~/.powereagle` tree and obsolete browser-storage keys once, then create a versioned clean state root. Preserve external local source directories and the shared `~/.saucepan` store. No old package, theme, enablement, or conversation data is migrated.
- Integrate Saucepan 0.6 through its shared executable and declarative recipes. Use an authenticated Power Eagle app for durable package views and allow unscoped acquisition for session-only preview or validation.
- Affects package/schema APIs, compiler/SDK tooling, React integration, installation, AI prompts/storage, runtime rendering, theme handling, and `.eagleplugin` packaging. Exact embedded runtime/module-loading support remains an explicit in-Eagle feasibility checkpoint.
- This change produces planning now; implementation and the host experiment belong to the subsequent apply phase.
