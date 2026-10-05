import { defineStylingProvider, type StylingProviderExport } from '../../sdui/sdk/provider';
import manifest from './manifest.json';
import tokens from './tokens.json';

export const paperPopExport: StylingProviderExport = {
  descriptor: manifest.exports[0] as StylingProviderExport['descriptor'],
  implementation: { tokens, variants: {}, overrides: {} },
};

export default defineStylingProvider([paperPopExport]);
