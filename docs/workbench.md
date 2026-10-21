# Using the workbench

Sources shows one row per plugin. Click a row to open its tool. The small status switch enables or disables the plugin; the filter narrows the list without changing the running tool.

Right-click a plugin and choose **Inspect plugin…** to view its contributions in the middle **Plugin details** panel. Keyboard users can focus a row and press **Shift+F10** or the **ContextMenu** key. The same menu contains ordering commands; clear the filter before reordering.

Details offers only the plugin's declared contribution categories. Choose a category to see its exports, activation switches, dependency usage, errors and recovery actions. Inspecting a plugin does not enable it or start its runtime. Runtime entries offer explicit **Open screen** buttons; screens requiring parameters still need the tool's own navigation to supply those parameters.

Use **×** or **Escape** within details to return to the previous tool and screen. Its local state and pending work remain intact while hidden. Selecting a source normally or opening a screen exits details. Disabling a plugin or dependency, changing its revision, or removing it still invalidates an obsolete runtime as usual.

Plugins without an available runtime show a short summary with an inspection entry. Sources, details and Agent identify the plugin being inspected; closing details restores the previous selection. Inspection is temporary and is not saved across reloads.
