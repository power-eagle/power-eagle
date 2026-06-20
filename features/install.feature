Feature: Install plugins from repositories
  Power Eagle adds a plugin repository as a local git-clone mirror under repos/,
  then installs a plugin by copying its whole directory into plugins/ and
  recording it in installed.json. Classification is static and never runs plugin
  code.

  Scenario: Adding a plugin repository clones and classifies it
    Given an empty Power Eagle home
    And a git repository "color-picker" that contains a plugin manifest
    When I add the repository by its url
    Then the repository is cloned into repos/color-picker
    And the repository is classified as a plugin

  Scenario: Adding a repository with no Power Eagle manifests is rejected
    Given an empty Power Eagle home
    And a git repository "not-a-plugin" with no manifest.json or marketplace.json
    When I try to add the repository by its url
    Then the add is rejected as not a Power Eagle repo
    And no directory remains under repos/

  Scenario: Installing a plugin copies its directory and records the install
    Given an empty Power Eagle home
    And an added plugin repository "color-picker"
    When I install the plugin "color-picker"
    Then the whole plugin directory is copied into plugins/color-picker
    And installed.json records the plugin id, name and version
