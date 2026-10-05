Feature: Declarative Eagle built-in tools
  Built-in tools use the same runtime and action contracts as installed packages.

  Scenario: Create a file with a normalized extension
    Given the File Creator is open with an Eagle file capability
    When I create notes with the extension .MD
    Then Eagle receives notes.md with Markdown starter content

  Scenario: Clear only verified missing libraries and open an available library
    Given Recent Libraries contains available, missing, and inaccessible entries
    When I clear verified missing entries and open the available library
    Then the missing entry is removed and Eagle receives the exact available path
