import example from '../../examples/runtime-flow/document';
import { compile } from '../sdui/authoring';
import { foundationCatalog } from '../sdui/authoring/foundation';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { ProviderExperiment } from './provider-experiment';

const canonical = compile(example, foundationCatalog);
const session = new RuntimeSession(example, foundationRuntimeCatalog);
export default function App() {
  return <main>
    <header><span>POWER EAGLE</span><h1>Language foundation</h1><p>New format · version 1</p></header>
    <section aria-labelledby="preview-title"><h2 id="preview-title">Validated runtime example</h2><RuntimeView session={session} /></section>
    <ProviderExperiment mode="repository" autoRun />
    <details><summary>Canonical runtime document</summary><pre>{canonical}</pre></details>
    <aside>This runtime uses scoped state, bindings, components, actions, and navigation. Compiled-provider integration remains gated on the Eagle report above; the release widget catalog is still being built.</aside>
  </main>;
}
