/**
 * Clipboard — a sample service plugin. It renders nothing; it exposes clipboard
 * helpers (backed by the injected eagle global) for other plugins to call via
 * rt.service('clipboard').
 */
import { definePlugin } from '../sdui/activate';

export const clipboard = definePlugin({
  manifest: { id: 'clipboard', name: 'Clipboard', version: '1.0.0', service: true, keywords: ['clipboard', 'service'] },
  provides: () => ({
    copy: (text: string): void => eagle.clipboard.writeText(text),
    read: (): string => eagle.clipboard.readText(),
  }),
});
