Feature: AI-driven plugin generation
  The AI tab turns a prompt into a runnable plugin: it builds a prompt from the
  user's instruction plus the live service and styling registries, asks the Eagle
  AI model for a self-contained definePlugin ESM module, writes it under
  ~/.powereagle/aidriven, loads and renders it, and records each attempt in a
  left-hand history that can be reselected.

  Scenario: Generating a plugin from a prompt renders it
    Given the AI tab with the service and styling registry in context
    When I submit a prompt and the model returns a plugin module
    Then the generated plugin is written under ~/.powereagle/aidriven
    And the generated plugin is loaded and its view is rendered

  Scenario: Each attempt is recorded in the history and can be reselected
    Given a prompt has been submitted and rendered
    When I select that attempt from the left history
    Then its generated plugin is rendered again

  Scenario: A generation that does not load is recorded as failed
    When I submit a prompt and the model returns an invalid module
    Then the failure is surfaced in the AI tab
    And the attempt is recorded as failed in the history
