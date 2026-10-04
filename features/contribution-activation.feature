Feature: Contribution activation
  Packages expose qualified exports that activate coherently, retain user intent,
  clean up their resources, and compose styling in an explicit order.

  Scenario: Resolve a runtime after its widget and styling providers
    Given a runtime depends on compatible widget and styling exports
    When the contribution dependency graph is built
    Then both providers precede the runtime in activation order

  Scenario: Isolate a dependency cycle
    Given two runtimes form a dependency cycle beside an unrelated runtime
    When the contribution dependency graph is built
    Then the cycle is diagnosed and the unrelated runtime remains available

  Scenario: Preserve individual choices through package toggles and reload
    Given one widget export is disabled
    When its package is disabled, enabled, and preferences are reopened
    Then that widget stays off while its sibling is active

  Scenario: Revoke and restore an active service dependency
    Given a runtime is active with a required service and an unrelated runtime
    When the required service is disabled and enabled again
    Then stale handles fail and enabled consumers recover in dependency order

  Scenario: Replace a view without stopping its service
    Given a view owns a resource created through an active package service
    When the runtime replaces that view
    Then the view resource is disposed and the package service stays active

  Scenario: Toggle a provider without accumulating resources
    Given a provider has one live resource
    When the provider is disabled and enabled repeatedly
    Then every completed lifetime is disposed once and one resource remains live

  Scenario: Roll back a provider activation failure
    Given one export in a provider group throws during activation
    When the contribution registrations are reconciled
    Then the group is hidden, prepared resources are disposed, and unrelated exports remain active

  Scenario: Reload changed provider code
    Given a service provider is active with its original implementation
    When its registration is replaced with an updated implementation
    Then new handles use the update and the old scope and handle are revoked

  Scenario: Count distinct declared consumers
    Given two packages directly require one export and another export is unused
    When contribution usage is inspected
    Then the provider is used by both package identities and the other export is unused

  Scenario: Remove a disabled optional theme
    Given an optional package theme and an explicit node color are selected
    When the optional theme becomes unavailable
    Then its values disappear while host defaults and the node color remain

  Scenario: Keep styling independent from discovery order
    Given selected themes have explicit package and view ordering
    When their catalog discovery order changes
    Then the composed tokens and styles remain identical
