# Proposal

## Why

Contribution categories, runtime screens and individual action names make the Sources list visually busy. Package inspection should be an intentional temporary view, while ordinary selection opens the tool.

## What Changes

- Keep Sources as compact plugin rows; move contribution and export navigation into a middle-panel inspector.
- Add **Inspect plugin…** to the existing native context menu, retaining reorder actions and keyboard access.
- Replace the Stage visually with a closable Plugin details panel. Closing restores the previous live selection and its runtime state; ordinary plugin selection exits inspection.
- Keep inspection inert, including when inspecting another plugin. Retain accessible enablement, dependency/error recovery, and explicit runtime screen opening in the details view.
- Give provider-only and unavailable tools a concise default summary with an inspection entry point.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workbench-shell`: simplify source navigation and introduce temporary inspection with state-preserving return and keyboard access.

## Impact

Changes are confined to the source list, shared workbench selection/presentation, activation inspector, shell panel controls, styles and their tests. No package format, manager protocol, storage migration or Agent authoring workflow changes. The deferred authoring-consistency backlog remains separate.
