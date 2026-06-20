Feature: Core input and list widgets
  The renderer gains two widgets the ported plugins need: an input that writes
  its value back to state through a declared closure, and a list that renders
  its children or an empty-state message when there are none.

  Scenario: Typing into an input writes back to the bound state
    Given a plugin whose view binds an input to state.name
    When the user types "hello" into the input
    Then state.name is "hello"
    And the input shows "hello"

  Scenario: A list renders one node per item
    Given a plugin whose view lists state.items as text rows
    When the plugin is rendered
    Then the list shows one row per item

  Scenario: A list shows its empty state when there are no items
    Given a plugin whose view lists an empty state.items with an empty message
    When the plugin is rendered
    Then the list shows the empty message
