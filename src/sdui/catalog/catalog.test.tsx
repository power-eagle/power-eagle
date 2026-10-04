// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import publishedCatalog from '../../../docs/catalog/builtins.json';
import { CatalogGallery } from '../../components/catalog/catalog-gallery';
import { Card } from '../authoring/content';
import { foundationCatalog } from '../authoring/foundation';
import { validateRuntime } from '../schema/validate';
import {
  builtinCatalogDocument, builtinCatalogEntries, createCatalogEntries, exampleDocument, type CatalogMetadata,
} from './builtins';

afterEach(cleanup);

describe('public widget catalog', () => {
  it('publishes each built-in contract with a valid runnable example', () => {
    expect(publishedCatalog).toEqual(builtinCatalogDocument);
    expect(builtinCatalogEntries).toHaveLength(Object.keys(foundationCatalog.widgets).length);
    expect(builtinCatalogEntries.map(entry => entry.type)).toEqual([...builtinCatalogEntries.map(entry => entry.type)].sort());
    for (const entry of builtinCatalogEntries) {
      expect(entry.origin).toEqual({ kind: 'builtin' });
      expect(entry.availability).toBe('active');
      for (const field of ['defaults', 'events', 'example', 'properties', 'slots', 'themeHooks']) {
        expect(field in entry.contract, `${entry.type}.${field}`).toBe(true);
      }
      expect(entry.contract.example.type).toBe(entry.type);
      expect(validateRuntime(exampleDocument(entry.runnableExample), foundationCatalog), entry.type).toMatchObject({ success: true });
    }
  });

  it('renders every advertised type in the gallery instead of a placeholder', () => {
    const { container } = render(<CatalogGallery />);
    for (const entry of builtinCatalogEntries) {
      const article = container.querySelector<HTMLElement>(`[data-catalog-type="${entry.type}"]`);
      expect(article, entry.type).not.toBeNull();
      expect(article?.querySelector(`[data-pe-widget="${entry.type}"]`), entry.type).not.toBeNull();
      expect(article?.textContent).toContain(entry.availability);
      expect(article?.textContent).toContain('property schema');
    }
  });

  it('carries package origin, effective availability, and failure details for installed types', () => {
    const type = 'example.ui/card';
    const contract = { ...Card.contract, example: { ...Card.contract.example, type } };
    const metadata: CatalogMetadata = {
      family: 'custom', origin: { kind: 'package', package: 'example.ui', version: '2.1.0', export: 'card' },
      availability: 'failed', diagnostic: 'dependency-off: example.theme/dark',
    };
    expect(createCatalogEntries({ widgets: { [type]: contract } }, { [type]: metadata })[0]).toMatchObject({
      type, family: 'custom', origin: metadata.origin, availability: 'failed', diagnostic: metadata.diagnostic,
    });
  });
});
