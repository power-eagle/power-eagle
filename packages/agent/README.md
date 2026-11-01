# Agent workflow and React surfaces

A browser-safe headless conversation controller, bounded context builder and
optional React 18 conversation/settings panels. The package does not depend on
local CLI providers, Node process modules, Eagle or a particular document schema.

Public entry points:

- `@power-eagle/agent`: controller, context builder and neutral types.
- `@power-eagle/agent/react`: `AgentPanel` and `AgentSettingsPanel` (React 18 peer).
- `@power-eagle/agent/styles.css`: scoped standalone styles.

ESM and CommonJS entries have matching declarations for TypeScript NodeNext,
Node16 and Bundler resolution. Headless consumers do not need React. React
consumers install React 18 and their renderer themselves; React is not bundled.

Run `npm run build`, `npm test` and `npm pack` in this package directory with its
declared development dependencies installed. Install the archive into a consumer
with `npm install /path/to/power-eagle-agent-0.1.0.tgz`. Archives include compiled
output and documentation; no runtime source transpiler or workspace alias is
required. Public registry publication and licensing are outside this local build.

## Host-owned documents and persistence

The runnable `examples/text-editor.mjs` implements the complete contract using
ordinary text. After building, run `node examples/run.mjs` for a synthetic
generation and an earlier-base follow-up using historical instructions.

Construct `new AgentController({ host, providers, inputBudget?, generate? })`.
Provider registrations contain `{ id, label, adapter, managed?, setupHint? }`.
The adapter supplies `available()`, `discover()` and `generate({ prompt, model?,
effort? })`. IDs and context flags are caller-defined; duplicate registrations
are rejected. `managed.description` explains externally configured providers.
The optional controller `generate(request)` override receives the captured
conversation/request/base/context/provider identity for existing host dispatchers.

The host supplies:

| Method | Obligation |
| --- | --- |
| `read(id)`, `list()` | Return current records with correct conversation ownership. |
| `update(id, mutation)` | Publish the complete mutation atomically or reject without durable changes; preserve unrelated host fields. |
| `selectBase(id, revision)` | Validate revision ownership, persist selection and return the record. |
| `prepare(id, turn)` | Supply complete mandatory instructions, selected document and domain contracts. |
| `apply(id, turn, response)` | Validate and atomically publish the revision and successful turn together; return the durable record. |

The controller does not provide filesystem atomicity. The example's synchronous
in-memory publication is not a substitute for a database transaction or durable
filesystem protocol. Hosts own validation, activation, rollback, storage format
and revision navigation. Positive integer request/revision identifiers describe
a versioned document workflow, not an arbitrary revision graph.

Use `record(id)` for a detached snapshot, `draft`, `context`, `settings`,
`selectBase`, `send`, `retry`, `editRequest`, and `recoverInterrupted` for actions.
`subscribe(listener)` returns an unsubscribe function; `snapshot()` is a revision
counter suitable for React's `useSyncExternalStore`. `busy(id)` and `error(id)`
describe pending work and composer fallback errors. Catalog snapshots are detached;
`discover(id, true)` refreshes the cache and concurrent discovery is coalesced.

Each request captures settings, base and context flags. Retry preserves the
failed instruction/base/flags and uses current provider choices; legacy missing
flags are identified explicitly. Edit preserves an existing draft until
`replaceDraft` is true. Unknown providers never fall back. A failed pending write
keeps the draft; failures with durable requests attach to the request. If that
failure write also fails, `error(id)` reports the fallback without claiming a
saved outcome. Recovery marks pending requests interrupted without resubmitting.

Context defaults to an estimated 48,000-token input budget (UTF-8 bytes divided
by three). Complete mandatory content is never sliced. Newest complete eligible
exchanges are retained chronologically; hidden/pending turns are excluded and
omission metadata is exposed. Mandatory overflow fails before dispatch. This is
an application estimate, not a claim about a provider's model capacity.

## React and appearance

Import the stylesheet once, then render `AgentPanel` with `agent`,
`conversationId`, `title`, revisions/current revision, context controls and an
`onSettings` callback. Optional labels and notices adapt the feature to your app.
Render `AgentSettingsPanel` with the same agent/conversation in the host's chosen
panel. The package does not manage application routes, dialogs or live tools.
Each composer has its own ID/focus ref; changing conversation remounts its editor.

Styles are scoped to `.ak-agent-context` and `.ak-agent-settings` and their
`ak-` descendants. Give the conversation container a definite height to obtain
independent history scrolling. No Tailwind, global reset or app component is
required. Override `--ak-background`, `--ak-foreground`, `--ak-muted-foreground`,
`--ak-border`, `--ak-primary`, `--ak-primary-foreground`, `--ak-secondary`,
`--ak-accent`, `--ak-input`, `--ak-ring`, `--ak-destructive`, `--ak-radius`,
`--ak-line-width`, `--ak-font`, `--ak-font-mono` and `--ak-space-2` on a containing
element to adapt appearance. Defaults include visible keyboard focus and contrast.
