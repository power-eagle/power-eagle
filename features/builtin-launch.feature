Feature: Launch a built-in plugin in the host
  The host launches a bundled v3 plugin by id, activating it with the host
  Eagle bridge and rendering its view through the registry-driven renderer.

  Scenario: Launching a built-in plugin renders its view
    Given the host launches the built-in plugin "file-creator"
    When the plugin view settles
    Then the File Creator view is shown

  Scenario: Launching an unknown built-in shows a not-found message
    Given the host launches the built-in plugin "no-such-plugin"
    When the plugin view settles
    Then an unknown-plugin message is shown
