import { useEffect, useMemo } from 'react';
import { builtinCatalogEntries, exampleDocument, type CatalogEntry } from '../../sdui/catalog/builtins';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { RuntimeSession } from '../../sdui/runtime/session';
import { RuntimeView } from '../../sdui/runtime/view';
import { Badge } from '../ui';

function CatalogExample({ entry }: { entry: CatalogEntry }) {
  const session = useMemo(() => new RuntimeSession(
    exampleDocument(entry.runnableExample), foundationRuntimeCatalog, {}, path => `./${path}`,
  ), [entry]);
  useEffect(() => () => { void session.dispose(); }, [session]);
  return <RuntimeView session={session} />;
}

function summary(value: object): string {
  const keys = Object.keys(value);
  return keys.length ? keys.join(', ') : 'none';
}

export function CatalogGallery() {
  return <section className="pe-catalog pe-ground" aria-labelledby="catalog-title">
    <header className="pe-catalog-header">
      <div><span className="pe-label">public widget catalog</span><h2 id="catalog-title">Built-in contracts and live examples</h2></div>
      <span className="pe-meta">{builtinCatalogEntries.length} active types · format 1</span>
    </header>
    <div className="pe-catalog-grid">
      {builtinCatalogEntries.map(entry => <article className="pe-catalog-entry" data-catalog-type={entry.type} key={entry.type}>
        <header>
          <code>{entry.type}</code>
          <Badge variant="outline">{entry.family}</Badge>
          <span className="pe-meta">{entry.availability}</span>
        </header>
        <div className="pe-catalog-preview" aria-label={`${entry.type} example`}><CatalogExample entry={entry} /></div>
        <dl>
          <div><dt>defaults</dt><dd>{summary(entry.contract.defaults)}</dd></div>
          <div><dt>slots</dt><dd>{summary(entry.contract.slots)}</dd></div>
          <div><dt>events</dt><dd>{summary(entry.contract.events)}</dd></div>
          <div><dt>themes</dt><dd>{entry.contract.themeHooks.join(', ') || 'none'}</dd></div>
        </dl>
        <details>
          <summary>property schema</summary>
          <pre>{JSON.stringify(entry.contract.properties, null, 2)}</pre>
        </details>
      </article>)}
    </div>
  </section>;
}
