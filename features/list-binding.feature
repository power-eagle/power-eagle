Feature: List control-flow and per-item variable passing
  A list binds a collection with `for`, renders each item through `render`
  (the item passed as an accessor), shows `empty` when the collection is empty,
  and lets a per-item action receive the bound item.

  Scenario: A for/render list renders one row per item using item data
    Given a plugin that lists two items with for/render
    When the plugin is rendered
    Then each item's label is shown

  Scenario: The empty widget shows when the collection is empty
    Given a plugin that lists an empty collection with an empty widget
    When the plugin is rendered
    Then the empty widget is shown

  Scenario: A per-item action receives the bound item
    Given a plugin that lists two items each with a pick action
    When the user picks the second item
    Then the picked id is the second item's id
