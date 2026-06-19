Feature: Plugin rendering
  Plugins render through the widget registry and react to user input.

  Scenario: An interaction updates the rendered UI
    Given an activated counter plugin
    When the user clicks the increment button
    Then the counter label shows "count: 1"
