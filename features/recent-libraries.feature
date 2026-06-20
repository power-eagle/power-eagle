Feature: Recent Libraries plugin
  The recent-libraries plugin, ported to definePlugin + w(), loads recent Eagle
  libraries from the host on mount, filters them by a search query, and clears
  invalid entries. The visible list is a reactive view over state.filtered.

  Scenario: Mounting loads recent libraries from the host
    Given an activated recent-libraries plugin whose host has two libraries
    When the plugin is rendered
    Then both library names are shown

  Scenario: Filtering narrows the visible libraries
    Given an activated recent-libraries plugin whose host has two libraries
    When the user filters by "foo"
    Then only the matching library is shown

  Scenario: Clearing invalid removes invalid libraries
    Given an activated recent-libraries plugin whose host has two libraries
    When the user clicks Clear Invalid
    Then the invalid library is removed
