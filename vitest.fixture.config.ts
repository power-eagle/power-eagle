import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/host/install/provider-probe.test.ts'] },
});
