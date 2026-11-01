import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentPanel, AgentSettingsPanel } from '@power-eagle/agent/react';
import '@power-eagle/agent/styles.css';
import { createTextEditor } from './text-editor.mjs';

const editors = ['A', 'B'].map(name => createTextEditor({
  read: () => JSON.parse(localStorage.getItem(`agent-example-${name}`) ?? 'null'),
  write: value => localStorage.setItem(`agent-example-${name}`, JSON.stringify(value)),
}));
for (const editor of editors) await editor.agent.recoverInterrupted();
function Conversation({ index, settings }) {
  const editor = editors[index];
  useSyncExternalStore(editor.agent.subscribe, editor.agent.snapshot, editor.agent.snapshot);
  return <AgentPanel agent={editor.agent} conversationId="document" title={`Document ${index === 0 ? 'A' : 'B'}`}
    revisions={[...editor.documents.keys()].map(id => ({ id }))}
    contextControls={[{ id: 'dictionary', label: 'Dictionary' }]}
    onSettings={() => settings(index)} composerLabel={`Edit document ${index === 0 ? 'A' : 'B'}`} />;
}
function Demo() {
  const [selected, setSelected] = useState(0);
  return <>
    <h1>Independent text editor</h1>
    <p>This fixture installs packed packages and uses only the packaged Agent stylesheet. Use FAIL_ONCE to test recovery.</p>
    <button id="host-control">Unstyled host control</button>
    <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 16 }}>
      {[0, 1].map(index => <div key={index} style={{ height: 600, minWidth: 0, border: '1px solid #aaa' }}><Conversation index={index} settings={setSelected} /></div>)}
      <div style={{ height: 600, minWidth: 0, border: '1px solid #aaa' }}>
        <h2>Settings for document {selected === 0 ? 'A' : 'B'}</h2>
        <AgentSettingsPanel key={selected} agent={editors[selected].agent} conversationId="document" />
      </div>
    </main>
  </>;
}
createRoot(document.getElementById('root')).render(<Demo />);
