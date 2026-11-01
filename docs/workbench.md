# Using the workbench

The Agent conversation and settings panels use the reusable Agent package.
Power Eagle supplies plugin labels, API context switches, revisions, navigation
and theme variables; the package owns the neutral conversation controls.
Developer build and reuse instructions are in [Agent packages](agent-packages.md).

Sources shows one row per plugin. Click a row to open its tool. The small status switch enables or disables the plugin; the filter narrows the list without changing the running tool.

Right-click a plugin and choose **Inspect plugin…** to view its contributions in the middle **Plugin details** panel. Keyboard users can focus a row and press **Shift+F10** or the **ContextMenu** key. The same menu contains ordering commands; clear the filter before reordering.

Details offers only the plugin's declared contribution categories. Choose a category to see its exports, activation switches, dependency usage, errors and recovery actions. Inspecting a plugin does not enable it or start its runtime. Runtime entries offer explicit **Open screen** buttons; screens requiring parameters still need the tool's own navigation to supply those parameters.

Use **×** or **Escape** within details to return to the previous tool and screen. Its local state and pending work remain intact while hidden. Selecting a source normally or opening a screen exits details. Disabling a plugin or dependency, changing its revision, or removing it still invalidates an obsolete runtime as usual.

Plugins without an available runtime show a short summary with an inspection entry. Sources, details and Agent identify the plugin being inspected; closing details restores the previous selection. Inspection is temporary and is not saved across reloads.

The compact provider/model button in **Agent** opens **Agent settings** in the middle panel, beside the conversation. Choose Eagle supplied, Claude, or Codex; local providers offer discovered models, supported effort, Reconnect, and Refresh models. Settings are saved per plugin and apply to the next request. Closing with **×** or **Escape** returns to the previous Stage or Plugin details view and restores focus to the Agent button. Selecting another source exits settings. The retained runtime keeps its local state while hidden, subject to normal activation and revision invalidation.

Requests stay in the conversation. A failure offers **Retry** or **Edit request** and displays its error once. Editing does not send; an existing draft is kept until you choose **Replace draft**. Successful Agent outcomes link to saved revisions. Each request receives prior conversation context alongside the selected revision's document; long histories show when older exchanges were omitted from the request. See [Agent providers and context](agent-providers.md) for setup and record compatibility.

Package management is in the Sources footer. **Add package** accepts a local
folder, Git reference/commit or URL; Install creates a persistent workspace and
Preview creates a session entry. The selected entry is labeled **Installed
source · revision N** or **Session preview**. Refresh affects the selected
installation; Close preview ends its session. During acquisition, a status
message identifies the operation and the form is disabled. A failure appears
in an alert; an invalid refresh retains the prior revision. Package-store setup
is explicit and is not triggered by opening the workbench.

Native form controls support keyboard navigation and submission. At narrow
widths, collapse Sources and Agent using their header controls to retain room
for Stage. Blueprint and Paper Pop retain the running tool when switched.
The workbench BDD in `features/workbench.feature` checks filtering, keyboard
inspection/return, and required-export failure/recovery with persisted enablement.
