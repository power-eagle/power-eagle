# Agent providers and conversation context

Claude and Codex now come from `@power-eagle/agent-providers`; conversation logic
and optional React panels come from `@power-eagle/agent`. Eagle supplied, runtime
contracts, version-2 persistence and activation stay in Power Eagle's host
adapters. See [package build and acceptance](agent-packages.md) for independent
reuse, public APIs and the distinction between synthetic and live evidence.

Each plugin keeps its conversation, draft, selected base, and provider preferences. New conversations use **Eagle supplied**, which uses Eagle's configured default chat model. Choose **Claude** or **Codex** in Agent settings to use an installed native CLI with its existing sign-in. Power Eagle does not install a CLI or store its credentials.

For CLI setup, use the provider's normal installer and sign in with `claude auth login` or `codex login` in a terminal. Reopen Eagle if its environment changed. Executables are discovered from PATH, the user's `.local/bin` and Scoop installations, and Codex's VS Code extension. `POWER_EAGLE_CLAUDE_BIN` and `POWER_EAGLE_CODEX_BIN` can specify an executable path; these are environment variables set before starting Eagle, not command strings. Scoop native targets are resolved so cleanup owns the actual CLI process.

Model menus come from installed providers. **Provider default** delegates model selection. Effort appears when reported by the model. Saved unavailable values stay visible; known unsupported effort must be corrected before sending. Reconnect rechecks CLI availability and refreshes discovery; Refresh models also performs a fresh bounded discovery. CLI availability does not prove sign-in or access to a model. Discovery does not generate a conversation turn or send a user prompt. Requests never silently fall back to another provider.

The CLI boundary uses hidden native child processes, argument arrays without a shell, a fresh temporary directory, explicit stdin prompts, disabled tools, and no project instructions. Claude uses restricted/safe mode and its initialization control response for model discovery; no Claude SDK is bundled. Codex uses app-server model discovery and ephemeral read-only generation with shell, patch, multi-agent, image and web tools disabled. Time limits are 5 seconds for availability, 15 seconds for discovery, and 120 seconds for local generation; stdout is capped at 4 MB. Only bounded in-memory diagnostics are classified into errors. Temporary directories are removed after process exit.

Claude major 2 and Codex major 0 are accepted across minor/patch updates, including prereleases and build metadata. A different major requires bridge review. Availability, discovery and generation check the reported version; discovery and generation recheck immediately before their protocol calls. The verified CLI versions and live-test limitations are in [Agent acceptance](agent-acceptance.md), and the shared policy is in [Bridge compatibility](bridge-compatibility.md). Those tested versions are not minimum pins. A CLI that rejects required flags must be updated or explicitly supported by a future adapter; Power Eagle does not relax its constraints automatically.

## Context and retries

Each request captures its provider/model/effort, base revision, API flags and assembled prompt before generation. Changing settings while it runs affects later requests. Each provider receives the complete selected runtime document, effective schema/contracts, current instruction, and the owning plugin's history. Earlier revision descriptions are history; the selected document remains authoritative. Failures are identified as unapplied.

The application uses an estimated **48,000 input-token budget**, calculated as UTF-8 bytes divided by three, rounded up. This is an application estimate, not a verified provider capacity. No model-specific capacities are currently assumed. Full eligible history is sent when it fits; otherwise only the newest complete exchanges are retained, with an explicit omission marker. The request shows a partial-history notice. Stored history stays intact. If mandatory document/contracts/instruction cannot fit, Agent fails before invoking the provider. Provider-side context errors may still occur for smaller-capacity models.

Retry appends a new attempt, preserving the failed request and its instruction/base/API flags, using current provider settings and current history/contracts. Historical version-1 turns did not record API flags; retry identifies when current flags are used instead. Edit request copies the instruction into the composer; a nonempty draft requires an explicit Replace draft choice. Failed requests display one error, and successful outcomes link to their saved immutable revision.

## Current-record upgrade and recovery

Conversation format 2 adds settings and request metadata. Current format-1 conversations are validated and upgraded in memory. The first catalog write involving old conversations saves the validated original to `workspaces/catalog.before-agent-v2.json` before replacing `catalog.json` atomically. A failed backup/write prevents publication. The backup is never overwritten. Hidden historical turns remain excluded from display and prompts; new per-turn removal is unavailable. This reader does not load pre-reset executable conversation data.

For rollback, stop Power Eagle and retain copies of the current catalog and revision folders first. The older application cannot read format-2 conversations. Restore the recovery catalog as `catalog.json` only after reconciling revisions and history created since the backup; restoring an older catalog alone hides those later records. This is a recovery procedure, not an automatic downgrade. Disposable fixture tests verify that the retained backup exactly matches the old catalog and can be read again without changing immutable revision artifacts.
