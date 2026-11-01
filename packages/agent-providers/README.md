# Agent providers

Claude and Codex adapters in one independently installable package. Neither
adapter requires the other CLI. The package returns text and does not interpret
your application's document format.

```js
import { createRequire } from 'node:module';
import { createClaudeProvider, createCodexProvider } from '@power-eagle/agent-providers';

const hostRequire = createRequire(import.meta.url);
const claude = createClaudeProvider({ hostRequire, executable: '/path/to/claude' });
const codex = createCodexProvider({ hostRequire, executable: '/path/to/codex' });
// Use either adapter independently. Existing CLI authentication is required.
const installed = await claude.available();
const models = await claude.discover(); // Initialization only; no inference.
const text = await claude.generate({ prompt: 'Edit this plain text.', model: models[0].id });
```

CommonJS uses `require('@power-eagle/agent-providers')` and supplies `require`
as `hostRequire`. Eagle supplies its native module loader explicitly. An absent
loader is reported when an operation is invoked. Importing or constructing an
adapter performs no host access or filesystem/process work. Public declarations
do not require consumers to install Node type definitions.

`available()` checks executable startup and version, not authentication.
`discover()` returns `{ id, label, isDefault?, efforts, defaultEffort? }` models.
`generate({ prompt, model?, effort? })` returns response text. Omitting model or
effort delegates the choice to the CLI. Errors classify availability, version,
authentication, quota, protocol, timeout and output failures without returning
raw credentials or prompts. There is no provider fallback.

An explicit executable is a single path, never a shell command. Without it,
lookup checks PATH, `.local/bin`, Scoop native installations and, for Codex on
Windows, installed VS Code extension binaries. Application-specific environment
variables are not read. The host may read its own overrides and pass them in.

Operations use literal argument arrays with `shell: false`, hidden windows,
owned temporary directories, stdin prompts and restricted CLI flags that disable
tools/MCP and inherited project instructions. Time limits are 5 seconds for
version checks, 15 seconds for discovery and 120 seconds for generation. Output
is limited to 4 MB, with a bounded diagnostic buffer. Cleanup waits for child
close and verifies directory ownership before removal. CLI installation, account
setup and runtime installation remain the consumer's responsibility.

Claude numeric major 2 and Codex numeric major 0 are accepted, including later
minor/patch and prerelease versions. Each discovery/generation rechecks the
version before protocol use. Unsupported majors require adapter review; accepted
versions must still support the required protocol and flags.

Runtime output targets Node 16.17 or later; development requires a Node version
supported by TypeScript/esbuild/Vitest. The pre-extraction adapters were exercised
in Windows Eagle Node 16.17.1 with Claude 2.1.266 and Codex
0.162.0-alpha.17.2. That historical evidence does not itself establish acceptance
of these extracted artifacts. Package tests exercise synthetic native processes
without inference; packaged live-host acceptance is recorded separately.

## Local build and reuse

From this directory, install the declared dependencies, then run `npm run build`,
`npm test`, and `npm pack`. Install the resulting archive with
`npm install /path/to/power-eagle-agent-providers-0.1.0.tgz`. Both ESM and CommonJS
entries include matching declarations; use TypeScript NodeNext/Node16 or Bundler
resolution. Compiled output and this document are packed; sources, tests and
temporary files are excluded. No registry publication or license grant is implied.
