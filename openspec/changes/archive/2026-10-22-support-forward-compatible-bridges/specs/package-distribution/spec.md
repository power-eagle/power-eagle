## MODIFIED Requirements

### Requirement: Current Saucepan central-store bridge
The host SHALL use the public Saucepan SDK and a manager >=0.10.0 in numeric major 0 with the required commands through an independently installed executable at `~/.saucepan/bin/saucepan[.exe]` or an explicit override. It SHALL inject an Eagle Node16-compatible transport using asynchronous literal argument arrays, temporary request files, and no shell. The SDK SHALL remain in the packaged CommonJS host bundle, isolated from browser imports. The application MUST NOT read or rewrite the encrypted manager index, reconstruct central content paths, use removed workspace/TOML/bucket commands, or download a private binary. Missing tooling and store failures SHALL produce clear package-management diagnostics without preventing built-in functionality from loading. Startup probing MUST be read-only; store initialization SHALL require an explicit setup action.

#### Scenario: Resolve a shared executable
- **WHEN** the configured compatible executable and initialized central store are available
- **THEN** Power Eagle invokes public SDK operations through the injected transport and consumes returned output paths and UUID metadata without inspecting the encrypted index

#### Scenario: Package manager unavailable
- **WHEN** Saucepan is missing, incompatible, or its store cannot open
- **THEN** acquisition controls report the failed operation and recovery while built-in runtime views remain usable
