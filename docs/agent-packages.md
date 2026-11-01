# Reusable Agent packages

Two local npm packages replace the earlier four-package draft:

| Package | Public contract | Application responsibilities |
| --- | --- | --- |
| `@power-eagle/agent-providers` | Claude/Codex availability, discovery and plain-text generation; private shared native transport | Explicit host module loader and executable overrides; CLI authentication remains CLI-owned |
| `@power-eagle/agent` | Browser-safe headless workflow/context, optional `/react` panels and `/styles.css` | Records, atomic updates, prompt contracts, validation, revision publication, navigation and themes |

The package READMEs document installation, types, host obligations, effects and
errors. Power Eagle's `src/host/workspaces/agent.ts` maps its version-2 records
and runtime publication into the neutral contract. `agent-providers.ts` retains
Eagle supplied and the injectable dispatcher. Application panel files are thin
wrappers; `src/index.css` maps Blueprint/Paper Pop variables into the scoped CSS.
There is no new disk format or bundled React runtime.

## Reproduce the checks

From the repository root, install the locked dependencies with `npm ci`, then:

```sh
npm run packages:build
npm run packages:test
npm pack --workspaces --pack-destination .artifacts/agent-packages --json
npm run packages:check
npm test
npm run typecheck
npm run lint
npm run build
openspec validate extract-reusable-agent-packages --strict
```

Create `.artifacts/agent-packages` before packing in a fresh checkout. `dev`,
`test`, `test:watch`, `typecheck` and production build build the packages first.
Individual packages also have independent build/test/pack scripts. Their
archives contain emitted ESM/CJS, matching `.d.ts`/`.d.cts` declarations, docs,
and the Agent's CSS/examples. Public registry publication is separate work.

The consumer harness creates three installations under the operating system's
temporary directory, clears `NODE_PATH`, rejects workspace links and installs
only each fixture's declared dependencies. Providers run without Agent/React;
headless Agent runs without providers/React. Imports are checked as ESM and
CommonJS; declarations are checked with TypeScript NodeNext, Node16 and Bundler
resolution. **Node16 here is a TypeScript resolution mode, not runtime evidence.**
The current command-line consumer checks ran on Windows with Node 26.12.1.

The provider consumer executes both installed factories using real disposable
Node child processes implementing synthetic CLI protocols. The child PATH is
empty and every spawn is checked against that adapter's fixture: the other CLI
cannot be probed. It covers discovery, text generation, classified failure and
owned-directory cleanup. No credentials or paid inference are used.

The installed headless example proves a follow-up from an earlier base receives
prior instructions. The React consumer builds `examples/react-demo.jsx` against
installed public exports with only packaged CSS. Serve the reported directory
with a static server. It has separate A/B conversations, localStorage persistence,
custom and managed provider settings, and `FAIL_ONCE` for failure/retry/edit.
The host control intentionally retains browser-default styling.

## Requirement evidence

| agent-packages requirement | Evidence |
| --- | --- |
| Grouped reusable provider package | Both factories in the single archive; `providers.test.ts`, `native.test.ts`; installed `scripts/agent-provider-consumer.mjs` |
| Explicit and bounded provider execution | Lazy loader and owned transport; native timeout/overflow/spawn/path/cleanup tests; protocol argument and malformed-response tests |
| Portable headless Agent workflow | `controller.test.ts`; independent no-React import/type checks; packaged `examples/run.mjs` |
| Preserved portable request semantics | Controller/context tests for provenance, busy isolation, retry/edit/recovery, persistence failures, snapshot isolation and bounded complete history |
| Complete portable Agent presentation | `panels.test.tsx`; custom/managed providers, missing choices, loading/error/refresh, protected drafts, focus and controller/conversation switching |
| Standalone scoped Agent styling | Packaged stylesheet and React demo; native-browser appearance/keyboard inspection; app theme mapping |
| Portable distribution and public declarations | Pack file lists; three external installations; ESM/CJS runtime imports and three declaration-resolution modes |
| Power Eagle adapter compatibility | Existing app/host regression suites: version-2 reader/recovery, runtime validation/rollback, revision ownership, retained settings/Stage state and themes |
| Evidence for independent reuse | External consumer command report and synthetic native fixture; live checks remain separately tracked below |

Package tests: 22 Agent tests and 27 provider tests. Application regression:
349 passing tests, 19 skipped. The skipped tests are not claimed as evidence.
Lint, typecheck and production build pass. Strict validation of the package
change passes; this does not mean implementation acceptance is complete.

## Evidence locations and remaining live acceptance

`.artifacts/agent-packages/consumers.json` records each external installation,
runtime, exact commands and passing import/declaration checks. `packs.json`
records archive contents. Packed tarballs and external fixture directories are
retained locally for inspection. These generated artifacts are ignored by Git;
the scripts and packaged examples make them reproducible.

Native Zen browser inspection of the installed React fixture verified normal
three-column layout and the responsive 490-pixel viewport, independently
scrolling history, readable settings, browser-default host control styling,
visible keyboard focus and keyboard Send. A saved generation, synthetic failure,
linked successful Retry and Edit-to-composer focus were observed. Reload retained
the selected Text model, successful/failed attempts, A's edited draft and B's
independent draft. Context-dependent follow-up is additionally asserted by the
installed headless example; the synthetic provider echoes supplied history and
does not establish a model's reasoning quality.

The original live results in [Agent acceptance](agent-acceptance.md) predate
extraction. They are historical evidence, not a rerun of the packaged build.
The new build still needs real Eagle Node 16 loading, local catalogs/generation,
context follow-up, settings/Stage restoration and persisted reload checks.
Eagle's previously configured endpoint at `localhost:1234` refused connections
during this work, so Eagle-supplied generation/follow-up remains incomplete.
Synthetic checks cannot clear that separate acceptance item.

Keep extraction and the original redesign active until their remaining live
checks pass. The deferred authoring-consistency overhaul remains a separate
backlog item with no approved implementation design.
