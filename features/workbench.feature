Feature: Non-authoring workbench continuity
  Sources, Stage and inspection share a target while preserving live state and
  making activation failures recoverable without affecting unrelated tools.

  Scenario: Filter sources without changing the running tool
    Given Runtime flow is open with a count of one
    When the source list is filtered to Clipboard and cleared
    Then Runtime flow remains selected with its count intact

  Scenario: Inspect another plugin using the keyboard and return
    Given Runtime flow is open with a count of one
    When Recent Libraries is inspected using the keyboard
    Then its details are shown without starting its runtime
    When Escape closes inspection
    Then Runtime flow resumes with its count and source-row focus

  Scenario: Recover a runtime whose required action is disabled
    Given File Creator is open
    When its required create action is disabled in inspection
    Then the runtime reports the disabled dependency and other sources remain usable
    When the required export is enabled through recovery
    Then File Creator becomes available again and the choice survives reopening
