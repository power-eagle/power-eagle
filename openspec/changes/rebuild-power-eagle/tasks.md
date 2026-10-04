# Tasks

Work only in `power-eagle-revised`; use `power-eagle` and `power-eagle-design-system` as read-only references. Preserve unrelated existing changes. Each numbered group is a reviewable checkpoint, including its verification and documentation. Checkpoint 1's real Eagle evidence is required before dependent package integration; independent schema and presentation work can proceed if host access is unavailable, but the experiment must remain incomplete. No implementation task is completed by this planning change.

## 1. Verify compiled providers inside Eagle

- [x] 1.1 Create an isolated runnable Eagle loader fixture and minimal build harness under the revised repository, preserving existing module boundaries; verify it builds/launches without using the reference repository's `node_modules` or altering live package data.
- [x] 1.2 Build two fixture packages with separate versions of one pure-JavaScript dependency, package-relative assets, and explicit `.cjs` entries; verify their artifacts are self-contained and loader tests resolve each dependency from its owning package.
- [x] 1.3 Prove host React/ReactDOM/JSX-runtime sharing with a hook-using third-party widget and the proposed SDK/build mapping; verify interactive rendering, asset loading, disable/re-enable, disposal, and changed-code reload in actual Eagle, not only Node or a browser preview.
- [x] 1.4 Record the tested Eagle build, embedded runtime, module-bridge availability, fixture steps, and results in `docs/provider-host-validation.md`; verify the report distinguishes passed host observations from simulated tests and stops dependent loader integration if the required behavior fails.

## 2. Establish the new language and package contracts

- [x] 2.1 Restore a minimal new application entry and reproducible TypeScript/Vite/test configuration within the inherited source layout; choose one package-manager lockfile and remove stale seed/deleted-module references, then verify install, typecheck, a minimal build, and the test runner from the revised workspace.
- [x] 2.2 Implement versioned runtime/package schemas under `src/sdui`, including contribution descriptors, qualified exports, version ranges, dependencies, asset references, nodes, bindings, screens, and actions; verify positive fixtures and rejection of legacy payloads, unknown fields/types, missing exports, invalid slots, and unsupported versions with path-specific diagnostics.
- [x] 2.3 Implement the typed authoring model, reusable inputs/slots, canonical JSON emission, and schema-derived declarations; verify compile-and-load examples, deterministic output, independent component instances, and rejection of nonserializable handlers or partial build output.
- [x] 2.4 Publish the initial language/package reference and a runtime-only example in `docs` and `examples`; verify documented build/validation commands run against the new schema and contain no v2/v3 authoring instructions.

Checkpoint evidence (2026-10-04): clean `npm ci`, typecheck, lint, production build, application/language tests, declaration emission, JSON Schema export, example compilation, and example validation commands pass. `npm run fixture:check` builds relocated private-dependency artifacts and passes 3 Node tests. The normal revised plugin then passed all 14 provider checks in Eagle 4.0.0 build 23 on Windows x64 with Electron 22.3.7 and Node 16.17.1. See `docs/provider-host-validation.md`. This satisfies the compiled-provider feasibility gate; production package integration remains checkpoint 4 work.

## 3. Implement executable language behavior

- [x] 3.1 Implement scoped state, typed references, documented expression operators, and keyed component/list identity in `src/sdui/state` and the renderer; verify isolation, typed values, collection reorder/removal, empty states, invalid-expression diagnostics, and absence of rendering side effects.
- [x] 3.2 Implement action dispatch with argument/result validation, state updates, conditions, sequential/parallel composition, registered calls, requests, and success/error bindings; verify result ordering, unhandled-failure stopping, parallel result isolation, and explicit error handling using controlled adapters.
- [x] 3.3 Implement named-screen navigation, parameter validation, view-local back/replace/reset behavior, async cancellation, and resource disposal; verify late completions cannot mutate replacement views and back navigation follows the documented state lifetime.
- [x] 3.4 Extend `docs` and runnable examples with bindings, expression semantics, navigation, and action composition; verify each example through the public compiler/runtime and land BDD scenarios for the observable flows in `declarative-language`.

Checkpoint 3 evidence (2026-10-03): typecheck, zero-warning lint, production build, 72 unit/integration/BDD checks, both example builds, four example validation commands, JSON Schema export, and SDK declaration emission pass. The interactive `runtime-flow` example exercises typed bindings, keyed repetition/empty content, sequential result bindings, parallel writes, named-action status, parameterized navigation, and back. Controlled tests additionally cover call input/output validation, request failure branches, result ordering/isolation, view cancellation, disposer cleanup, keyed component state retention, and no render-time action dispatch.

## 4. Deliver the compiled contribution SDK and package build

- [x] 4.1 Implement manifest-first discovery and the proven compiled-provider loading path in `src/host/install`; verify provider-only and mixed packages, declared-path handling, no code execution during discovery, export/schema mismatches, and missing dependency diagnostics.
- [x] 4.2 Implement widget/action/service/styling SDK factories and shared-runtime injection using checkpoint 1's verified approach; verify a newly installed hook-using widget renders through a runtime document without rebuilding Power Eagle and private dependencies remain isolated.
- [x] 4.3 Implement provider compilation and self-contained artifact assembly, including ESM dependency bundling where needed, production `node_modules`, assets, and platform/SDK metadata; verify clean-directory installation without development source, external package-manager links, or runtime dependency installs.
- [x] 4.4 Implement canonical package-relative entry/asset resolution, supported-target diagnostics, and package-scoped cache replacement; verify traversal/symlink escape rejection, relocated assets, unsupported native targets, and updated code without disturbing unrelated dependency instances.
- [ ] 4.5 Publish SDK, build, asset, dependency, and supported-runtime documentation with provider-only and mixed examples; verify the examples build/install through the public contract and reproduce the host-loader behavior established in checkpoint 1.

Task 4.1 evidence (2026-10-04): manifest-first discovery canonicalizes declared entries/assets, parses runtime JSON, verifies runtime screen descriptors, and does not evaluate compiled code. The production loader anchors CommonJS resolution to `manifest.json`, injects shared modules and declared assets, requires exact manifest/provider descriptor agreement, and reports missing private dependencies against the owning contribution. Four focused tests cover provider-only and mixed discovery, nested declared paths, no discovery side effects, runtime loading, descriptor mismatches, missing files, and missing npm dependencies. Typecheck, zero-warning lint, all 80 application/BDD tests, and the production build pass.

Task 4.2 evidence (2026-10-04): typed widget, action, service, and styling factories emit the compiled provider contract and public declarations. The loader requires host React, ReactDOM, and JSX runtime injection. A runtime integration test creates two installed packages at run time, loads separate `clsx` 1.2.1 and 2.1.1 copies from their own `node_modules`, registers the first package's hook-using widget in the runtime catalog, renders it through a validated runtime document, and verifies its interactive state update without rebuilding the host. Typecheck, zero-warning lint, declaration emission, all 83 application/BDD tests, 3 provider fixture tests, and the production build pass.

Task 4.3 evidence (2026-10-04): the public package builder compiles TS/TSX providers to Eagle-compatible CommonJS, keeps host rendering modules external, bundles an ESM-only fixture dependency, and copies explicitly external production dependency trees without symlinks. It stages and validates the complete manifest/runtime/provider/asset artifact before replacing an older output, and a failed rebuild preserves the previous artifact. The integration test deletes the authoring source, relocates the artifact to a clean temporary directory, confirms SDK/platform metadata and absence of source/build files or package-manager links, then discovers and loads the provider with `clsx` resolving from the relocated package and no install step. Typecheck, zero-warning lint, SDK declaration emission, all 85 application/BDD tests, 3 provider fixture tests, the production build, and strict OpenSpec validation pass.

Task 4.4 evidence (2026-10-04): discovery canonicalizes every declared entry and asset beneath the real package root, rejects traversal plus a Windows junction escape before code execution, and resolves a declared asset from a relocated installation. It compares manifest platform, architecture, and Node ranges with the host and reports all unsupported target dimensions. Production reload clears only cached files canonically owned by the changed package; a changed provider and its private dependency receive fresh instances while another installed package keeps the same dependency instance. Typecheck, zero-warning lint, SDK declaration emission, all 88 application/BDD tests, 3 provider fixture tests, the production build, and strict OpenSpec validation pass.

## 5. Activate and reconcile contributions

- [ ] 5.1 Implement the qualified export registry and dependency graph with version/kind checks, deterministic ordering, cycle detection, and declared direct-consumer counts; verify mixed cross-package references and independent operation after a missing provider, collision, or cycle.
- [ ] 5.2 Implement persistent package/export preferences and effective active/off/failed status; verify package toggles preserve export preferences across reloads, dependent failures identify their cause, and valid re-enablement recovers consumers.
- [ ] 5.3 Implement coherent registration, revocable service handles, dependent-first disposal, and view-versus-provider lifetimes; verify partial activation cleanup, stale-handle rejection, repeated toggles without resource accumulation, and view replacement without stopping unrelated services.
- [ ] 5.4 Implement ordered token/theme/variant composition and targeted overrides; verify layer precedence, explicit same-layer ordering, optional-style removal, required-style dependency failure, and separation of styling from widget implementation registration.
- [ ] 5.5 Document activation, dependencies, lifecycle, reload, usage counts, and styling semantics with examples; verify the contribution-activation BDD scenarios and focused registry/lifecycle tests pass before connecting shell toggles.

## 6. Establish production visual components and basic widgets

- [ ] 6.1 Port the design scaffold's tokens and reusable controls into `src/components/ui`, package IBM Plex fonts/licenses locally, and align full-color token mappings; verify a local component gallery visually matches the dark blueprint reference and has no network font dependency.
- [ ] 6.2 Implement Row, Column, Stack, Positioned, Wrap, Padding, Align, Center, SizedBox, ConstrainedBox, Expanded, Flexible, Spacer, and AspectRatio with schemas/helpers/examples; verify flex allocation, constraints, overflow, stable child identity, and invalid parent-child diagnostics.
- [ ] 6.3 Implement Text, RichText, SelectableText, Markdown, CodeBlock, Image, Icon, Badge, Divider, Card, and Tooltip with schemas/helpers/examples; verify non-executing content rendering, image errors, focus-accessible tooltips, and theme application.
- [ ] 6.4 Publish the catalog reference/gallery for these types and the custom-type documentation template; verify every supported type has a runnable example, public schema, defaults, slots, events, and actual rendering rather than a placeholder.

## 7. Deliver forms and desktop interactions

- [ ] 7.1 Implement Form, TextField, TextArea, NumberField, Checkbox, RadioGroup, and Switch with typed bindings and submission validation; verify numeric/boolean preservation, disabled/read-only behavior, associated error messages, and validation before submit.
- [ ] 7.2 Implement Select, Autocomplete, Slider, DatePicker, ColorPicker, and FilePicker with the host selection adapter; verify keyboard operation, controlled values, boundaries, cancellation, and missing-host diagnostics using injected fixtures.
- [ ] 7.3 Implement Button, IconButton, SegmentedControl, Tabs, Accordion, Menu, ContextMenu, Breadcrumbs, and SplitPane; verify focus/selection/event semantics, navigation actions, and pointer/keyboard resizing with minimum bounds.
- [ ] 7.4 Extend authoring helpers, catalog docs, examples, and behavior coverage for every control in this checkpoint; verify a keyboard-only form/navigation walkthrough and all referenced type schemas through the public runtime.

## 8. Deliver collections, feedback, and media

- [ ] 8.1 Implement ScrollView, ListView, GridView, VirtualList, and VirtualGrid; verify stable keys/selection, empty states, scrolling, and viewport-limited rendered work for thousands of fixture items.
- [ ] 8.2 Implement ReorderableList, TreeView, DataTable, and PropertyGrid; verify keyboard reorder, hierarchical selection, typed column sorting, retained row identity, and optional typed property editing.
- [ ] 8.3 Implement ProgressIndicator, Skeleton, EmptyState, ErrorState, Banner, Toast, and Dialog with language feedback actions; verify text-based status, retry transitions, stage-local overlays, modal focus, Escape/close behavior, and focus restoration.
- [ ] 8.4 Implement ImageGallery, ZoomableImage, AudioPlayer, and VideoPlayer; verify selection, zoom controls, playback/error states, unsupported media, and resource cleanup when a view is replaced.
- [ ] 8.5 Add schemas/helpers, catalog examples, and behavioral documentation for all types in this checkpoint; verify the gallery and the collection/feedback/media acceptance scenarios before proceeding.

## 9. Preserve package installation and storage behavior

- [ ] 9.1 Adapt the Saucepan bridge, verified binary cache, and configuration to the revised host while preserving the established root/index/path ownership; verify install/list/path/bucket operations with controlled runners and that tooling failure does not block built-ins.
- [ ] 9.2 Add discovery metadata sufficient to retain actual source identity and local in-place package paths; verify two same-transport sources remain distinct and discovery executes no provider code or rewrites Saucepan's index schema.
- [ ] 9.3 Integrate new-format validation and self-contained compiled artifacts into installation/refresh; verify runtime-only, provider-only, mixed, missing-dependency, unsupported-format, and compatibility-failure cases in temporary roots without building at install time.
- [ ] 9.4 Document the retained directory layout and installation/source workflows; verify old package files remain unchanged, diagnostics distinguish unsupported payloads from source failures, and documented examples resolve through Saucepan's reported paths.

## 10. Restore Eagle capabilities and useful tools

- [ ] 10.1 Adapt typed Eagle, Web API, filesystem, clipboard, file-picker, and library operations under the inherited host boundaries; verify actual result/error propagation with adapter tests and supported host observations without editing library metadata files directly.
- [ ] 10.2 Re-author File Creator and Recent Libraries as new-format built-ins; verify extension normalization and creation validation, name/path filtering, correct switch targets, evidence-based library validity, and explicitly documented list-only/history cleanup that never deletes library contents.
- [ ] 10.3 Implement AssetCard, AssetPicker, and AssetGrid with catalog contracts/examples; verify host-backed loading/empty/error states, stable selection, and asset identities passed to actions.
- [ ] 10.4 Implement FolderTree, TagPicker, LibraryPicker, MetadataEditor, and ImportQueue; verify typed host data, submitted metadata changes, cancelled choices, mixed import outcomes, and resource disposal with controlled fixtures and bounded Eagle checks.
- [ ] 10.5 Ship the clipboard service and widget/style examples through the common package contract; verify cross-package calls and built-in tool BDD scenarios, then document all Eagle widget/action contracts and supported host behavior.

## 11. Integrate the Sources, Stage, and Agent shell

- [ ] 11.1 Build the three-panel shell, independent scroll regions, accessible collapsed rails, and resilient stage boundary in `src/app`; verify the 910x750 layout and smaller/larger window behavior against the design reference with visual and keyboard checks.
- [ ] 11.2 Implement one shared selection model and source tree for built-ins, actual installation sources, generated packages, and mixed contributions; verify provider-only inspection, disabled-package inspection, runtime screen selection, versions, and selection without implicit enablement.
- [ ] 11.3 Wire package/export toggles and the activation inspector to the real activation graph; verify persisted preferences, active/off/failed text, direct-consumer counts, raw errors/recovery guidance, and coherent stage updates when dependencies are disabled.
- [ ] 11.4 Connect source registration and installation to the source footer and all stage loading/empty/off/error/ready states; verify install failures, successful source refresh, isolated render failures, keyboard use, and no old tabbed shell paths.
- [ ] 11.5 Document the workbench interactions and add BDD coverage for shared selection and recovery; verify the shell's tokens, outlined selection, focus, primary action, local typography, and source/agent accessibility in a production build.

## 12. Integrate AI document authoring and version history

- [ ] 12.1 Replace legacy module-generation prompts with schema/catalog-aware runtime-document generation and Eagle/Web API context controls; verify installed custom types are described, disabled exports are excluded, invalid output is diagnosed, and generated executable code is never run through this flow.
- [ ] 12.2 Implement new-format conversation records and immutable version payloads under the retained conversation paths, including base identity and monotonic allocation; verify reload, older-version refinement, turn deletion without version reuse, legacy-record preservation, and storage-error reporting.
- [ ] 12.3 Record model, validation, and activation failures and protect asynchronous turn ownership; verify duplicate-submit prevention, last-valid-stage retention, model unavailability, and completion after switching conversations without selecting or overwriting the wrong result.
- [ ] 12.4 Connect Agent controls and generated packages to the common catalog/selection/activation path; verify first generation, custom-widget use, version-chip selection, source-tree selection, conversation creation/selection, failed-turn deletion, and recovery with deterministic model fixtures.
- [ ] 12.5 Document the initial Agent scope and compiled-provider workflow and adapt AI conversation BDD coverage; verify a bounded live Eagle AI turn when a configured model is available and record any unavailable integration separately from simulated tests.

## 13. Package and verify the integrated release

- [ ] 13.1 Restore the required Eagle release assembly around the root manifest, `dist`, icon, localization, and local assets/licenses; verify archive contents contain the new built application without source-repo dependencies, stale legacy bundles, or unrelated template-sync automation.
- [ ] 13.2 Run the complete typecheck, lint, unit/BDD suite, production build, and package assembly from a clean dependency installation; verify every catalog entry promised by `widget-catalog` has its schema, working example, behavior coverage, and documentation.
- [ ] 13.3 Install the packaged build in Eagle and exercise runtime-only, provider-only, mixed/private-dependency packages, export revocation/recovery, useful built-ins, and Agent version selection; record runtime/platform evidence and unresolved failures without marking unexecuted checks complete.
- [ ] 13.4 Audit implementation against all eight capability specs and inspect the final diff; verify the inherited source/storage boundaries, rejection of legacy formats, preservation of old data and unrelated edits, and completeness of checkpoint evidence before requesting archive.
