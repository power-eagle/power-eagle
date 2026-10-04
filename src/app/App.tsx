import example from '../../examples/runtime-flow/document';
import { compile } from '../sdui/authoring';
import { foundationCatalog } from '../sdui/authoring/foundation';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { CatalogGallery } from '../components/catalog/catalog-gallery';
import { DesignSystemGallery } from '../components/ui/gallery';
import { ProviderExperiment } from './provider-experiment';

const canonical = compile(example, foundationCatalog);
const session = new RuntimeSession(example, foundationRuntimeCatalog);
export default function App() {
  return <>
    <DesignSystemGallery />
    <section className="pe-foundation" aria-labelledby="foundation-title">
      <header><span className="pe-label">language foundation</span><h1 id="foundation-title" className="pe-title">Validated runtime example</h1><p className="pe-meta">new format · version 1</p></header>
      <div className="pe-foundation-grid">
        <section aria-labelledby="preview-title"><h2 id="preview-title">Runtime flow</h2><RuntimeView session={session} /></section>
        <div>
          <ProviderExperiment mode="repository" autoRun />
          <details><summary>Canonical runtime document</summary><pre>{canonical}</pre></details>
        </div>
      </div>
      <aside>This runtime uses scoped state, bindings, components, actions, and navigation. The active built-in contracts and runnable examples follow below.</aside>
    </section>
    <CatalogGallery />
  </>;
}
