# Mixed contribution package

This package combines a runtime, hook-using widget, styling provider, declared SVG, and artifact-local `clsx`. `run.json` declares and renders `example.mixed/counter`; `src/types.tsx` and `src/styling.ts` use the public `@power-eagle/sdk` entry.

From the repository root:

```sh
npm run package:build -- examples/mixed-package/power-eagle.build.json .artifacts/mixed-package
```

The output contains `manifest.json`, `run.json`, `types.cjs`, `styling.cjs`, `assets/layers.svg`, `package.json`, and `node_modules/clsx`. The runtime and each provider remain independently declared contributions inside one installable artifact.
