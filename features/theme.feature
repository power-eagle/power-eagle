Feature: Themed rendering
  A loaded theme drives widget visuals: a widget's resolved style (tokens +
  variant) is applied to the rendered element, and a per-instance override wins
  over the theme. Swapping the theme changes the visuals with no plugin change.

  Scenario: A loaded theme styles a widget via a token
    Given a plugin with a single button
    And a theme that sets the button background to a color token
    When the plugin is rendered under the theme
    Then the rendered button carries the token-resolved background

  Scenario: A per-instance style overrides the theme
    Given a plugin whose button carries a per-instance background override
    And a theme that sets a different button background
    When the plugin is rendered under the theme
    Then the rendered button shows the per-instance background

  Scenario: A plugin's own theme overrides the global theme
    Given a plugin that ships its own button background theme
    And a global theme that sets a different button background
    When the plugin is rendered under the global theme
    Then the rendered button shows the plugin's background
