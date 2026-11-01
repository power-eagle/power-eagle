import { AgentController, createConversation } from '@power-eagle/agent';

// An in-memory example. A filesystem/database adapter must provide its own
// transaction for publishing the document and successful request together.
export function createTextEditor(storage) {
  const saved = storage?.read();
  let record = saved?.record ?? createConversation('document', 'writer');
  let documents = new Map(saved?.documents ?? [[1, 'Blank document']]);
  const copy = value => JSON.parse(JSON.stringify(value));
  const publish = (next, versions = documents) => {
    storage?.write({ record: copy(next), documents: [...versions] });
    record = copy(next); documents = versions;
  };
  const host = {
    read(id) { if (id !== record.id) throw Error('Unknown document'); return copy(record); },
    list() { return [copy(record)]; },
    async update(id, mutation) {
      const next = host.read(id); mutation(next); publish(next); return host.read(id);
    },
    async selectBase(id, revision) {
      if (!documents.has(revision)) throw Error('Unknown revision');
      return host.update(id, next => { next.selectedBase = revision; });
    },
    prepare(_id, turn) { return `Selected text: ${documents.get(turn.base)}\nInstruction: ${turn.instruction}`; },
    async apply(id, turn, response) {
      if (!response.trim()) throw Error('Empty text is not accepted');
      const next = host.read(id);
      const pending = next.turns.find(item => item.id === turn.id && item.status === 'pending');
      if (!pending) throw Error('Request no longer pending');
      const revision = Math.max(...documents.keys()) + 1;
      Object.assign(pending, { status: 'success', revision });
      publish(next, new Map([...documents, [revision, response]]));
      return host.read(id);
    },
  };
  let failedOnce = false;
  const generate = async ({ prompt }) => {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (prompt.includes('FAIL_ONCE') && !failedOnce) { failedOnce = true; throw Error('Synthetic provider failure; retry is available.'); }
    return `Edited text\n${prompt}`;
  };
  const agent = new AgentController({ host, providers: [
    { id: 'writer', label: 'Example writer', setupHint: 'Synthetic provider; no credentials or network calls.',
      adapter: { available: async () => true, discover: async () => [{ id: 'text', label: 'Text model', isDefault: true, efforts: ['low', 'high'] }], generate } },
    { id: 'managed', label: 'Managed writer', managed: { description: 'Configured by the text editor host.' },
      adapter: { available: async () => true, discover: async () => [], generate } },
  ] });
  return { agent, get documents() { return documents; } };
}
