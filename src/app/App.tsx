import example from '../../examples/runtime-flow/document';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { eagleSelectionAdapter } from '../host/eagle-selection';
import { WorkbenchShell } from './workbench-shell';

const session = new RuntimeSession(example, foundationRuntimeCatalog, { selection: eagleSelectionAdapter() });
export default function App() {
  return <WorkbenchShell
    stage={<RuntimeView session={session} />}
    stageTitle="Validated runtime example"
    stageCaption="example.runtime-flow · built-in · runtime"
  />;
}
