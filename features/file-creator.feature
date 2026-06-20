Feature: File Creator plugin
  The file-creator plugin, ported to definePlugin + w(), lets the user save
  quick-create extensions and create a file through the host. Saved extensions
  render as a reactive list of cards.

  Scenario: Adding an extension shows a new card
    Given an activated file-creator plugin rendered in the host
    When the user enters extension "md" and clicks Add Extension
    Then a card for ".md" is shown

  Scenario: Removing an extension removes its card
    Given an activated file-creator plugin rendered in the host
    When the user removes the ".txt" extension
    Then no card for ".txt" is shown

  Scenario: Creating a file invokes the host with the name and extension
    Given an activated file-creator plugin rendered in the host
    When the user enters file name "notes" and extension "md" and clicks Create File
    Then the host createFile is called with "notes" and "md"
