import {
  defineStylingProvider, type StylingProviderExport,
} from '@power-eagle/sdk';
import manifest from '../manifest.json';

const descriptor = manifest.exports.find(item => item.kind === 'styling') as unknown as StylingProviderExport['descriptor'];

export default defineStylingProvider([{
  descriptor,
  implementation: {
    tokens: { accent: '#ffb000', panel: '#111315' },
    variants: { compact: { gap: 6 } },
    overrides: { 'example.mixed/counter': { borderColor: '#ffb000' } },
  },
}]);
