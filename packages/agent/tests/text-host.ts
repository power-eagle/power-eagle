import { createConversation, type AgentHost, type AgentProvider, type Conversation } from '../src/index.js';

export const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
/** An atomic in-memory text editor, with no Power Eagle data or filesystem contract. */
export function textHost() {
  const records = new Map<string, Conversation>(['a', 'b'].map(id => [id, createConversation(id, 'writer')]));
  const documents = new Map<string, Map<number, string>>(['a', 'b'].map(id => [id, new Map([[1, 'Blank document']]) ]));
  const host: AgentHost = {
    read(id) { const record = records.get(id); if (!record) throw Error('Conversation missing'); return copy(record); },
    list: () => [...records.values()].map(copy),
    async update(id, mutation) { const next = host.read(id); mutation(next); records.set(id, copy(next)); return host.read(id); },
    async selectBase(id, revision) {
      if (!documents.get(id)?.has(revision)) throw Error('Revision missing');
      return host.update(id, record => { record.selectedBase = revision; });
    },
    prepare: (id, turn) => `Selected document: ${documents.get(id)?.get(turn.base)}\nCurrent instruction: ${turn.instruction}`,
    async apply(id, turn, response) {
      if (!response.trim()) throw Error('Text validation failed');
      const record = host.read(id); const versions = documents.get(id)!;
      const request = record.turns.find(item => item.id === turn.id);
      if (!request || request.status !== 'pending') throw Error('Request no longer pending');
      const revision = Math.max(...versions.keys()) + 1;
      Object.assign(request, { status: 'success', revision });
      // One synchronous publication; failed validation never changes either value.
      versions.set(revision, response); records.set(id, copy(record)); return host.read(id);
    },
  };
  return { host, records, documents };
}
export function writer(generate: (input: { prompt: string; model?: string; effort?: string }) => Promise<string> = async input => input.prompt): AgentProvider {
  return { id: 'writer', label: 'Text writer', adapter: { available: async () => true, discover: async () => [{ id: 'text', label: 'Text', isDefault: true, efforts: ['low'] }], generate } };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
