# Provider-only package

This package declares one widget and no runtime. `src/types.tsx` uses the public `@power-eagle/sdk` entry, host React hooks, a declared SVG, and an external `clsx` dependency that the builder copies into the artifact's own `node_modules`.

From the repository root:

```sh
npm run package:build -- examples/provider-only/power-eagle.build.json .artifacts/provider-only
```

The output contains `manifest.json`, `types.cjs`, `assets/bolt.svg`, `package.json`, and `node_modules/clsx`. It contains no `run.json` or TypeScript source.
