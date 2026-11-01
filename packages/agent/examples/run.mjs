import assert from 'node:assert/strict';
import { createTextEditor } from './text-editor.mjs';
const editor = createTextEditor(); const { agent } = editor;
await agent.draft('document', 'Retain Lighthouse'); await agent.send('document');
await agent.selectBase('document', 1);
await agent.draft('document', 'Add Harbor'); await agent.send('document');
assert.equal(agent.record('document').turns[1].status, 'success');
assert.match(editor.documents.get(3), /Lighthouse/); assert.match(editor.documents.get(3), /Harbor/);
console.log('Synthetic text-editor follow-up passed.');
