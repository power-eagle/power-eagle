Feature: Launch a built-in plugin in the host
  The host resolves a bundled v3 plugin by id and renders its module through the
  registry-driven runtime view; an unknown id resolves to no module.

  Scenario: Rendering a resolved built-in plugin shows its view
    Given the host resolves and renders the built-in plugin "file-creator"
    When the plugin view settles
    Then the File Creator view is shown

  Scenario: An unknown built-in id resolves to no module
    Given the host resolves the built-in plugin "no-such-plugin"
    Then no plugin module is resolved
