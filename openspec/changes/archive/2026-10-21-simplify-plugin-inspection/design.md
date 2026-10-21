## Context

Sources currently expands contribution categories and export/screen links beneath the selected plugin. The shell already offers an Eagle context menu for reordering, and ActivationInspector already owns export status, switches, dependencies and recovery. RuntimeStage disposes its session when unmounted, so replacing it conditionally would lose tool state.

## Goals / Non-Goals

Goals: compact plugin rows; deliberate contextual inspection; a closable middle panel; inert inspection; preservation of the current tool; accessible keyboard entry and exit.

Non-goals: package formats, activation semantics, Agent authoring redesign, additional windows, and persistent inspection preferences.

## Decisions

1. Extend the existing context menu with “Inspect plugin…”. Keep reorder actions and their filter/stale-target guards. Shift+F10 and ContextMenu open the same menu. Use a small contextual HTML fallback outside Eagle, dismissed on selection, Escape or outside interaction.
2. Retain live selection separately from a transient inspection target. Sources, middle-panel title and Agent identify the inspected target while details are open. Closing restores the live selection; normal source selection or explicit screen opening exits inspection. Revision changes are resolved against the current catalog and removed targets cannot remain inspectable.
3. Keep the existing live RuntimeStage mounted in a hidden container during inspection. Hidden content is excluded from focus and accessibility navigation. Inspecting another plugin never mounts its runtime. Existing disablement, removal and revision invalidation still dispose obsolete sessions. Inspection itself does not pause running work.
4. Replace the visible middle panel's Stage label with Plugin details and a named close control. Details uses only declared contribution categories and shows all exports in the chosen category. Runtime screens require an explicit Open screen action. Reuse activation controls and recovery; provider-only or unavailable normal selection shows a compact summary and inspection entry.
5. Move focus into details on open. Escape within details or the close control returns focus to the restored source row, falling back to the filter when that row is filtered out. The details panel occupies the existing middle region rather than covering another panel.

## Risks / Trade-offs

- Hidden runtime work continues: this preserves in-flight work and local state; explicit disablement and normal navigation retain their lifecycle semantics.
- A transient inspection target adds selection complexity: centralize selection transitions and test cross-plugin inspection, close, ordinary navigation and activation invalidation.
- Native menus are unavailable in browser previews: a contextual fallback keeps inspection and keyboard verification usable without permanent source-row buttons.

## Migration

No stored state or package migration. Existing sources, activation preferences and conversations are retained. Rollback restores the source tree and conditional Stage presentation.

## Verification

Focused component tests cover flat rows, menu and keyboard behavior, category navigation and activation recovery. App tests prove runtime state survives inspection, foreign targets remain inert, and disablement/navigation still invalidate sessions. Run TypeScript/build, lint, the application suite and strict OpenSpec validation; inspect the packaged UI in Eagle when available.
