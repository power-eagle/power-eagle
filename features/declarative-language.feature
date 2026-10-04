Feature: Declarative runtime flows
  Runtime documents bind typed state, compose actions, repeat keyed content,
  and navigate without executing JavaScript from the document.

  Scenario: A sequence exposes its prior result to the next action
    Given the runtime flow example is rendered
    When the user activates Increment
    Then the count and sequence result are displayed

  Scenario: Navigation passes parameters and back restores the prior view
    Given the runtime flow example is rendered
    When the user increments, opens details, and returns
    Then the home screen still displays the incremented count

  Scenario: Empty repeated content replaces keyed items
    Given the runtime flow example is rendered
    When the bound item collection becomes empty
    Then the declared empty content is displayed
