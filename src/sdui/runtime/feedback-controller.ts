import type { Json } from '../schema/model';

export interface FeedbackSnapshot {
  kind: 'toast' | 'dialog';
  open: boolean;
  value?: Json;
  revision: number;
}
interface FeedbackEntry extends FeedbackSnapshot { owner: symbol; cleanup(): void }

/** Session-local overlay state owned by the active declarative view. */
export class FeedbackController {
  #entries = new Map<string, FeedbackEntry>();
  #revision = 0;
  constructor(private readonly changed: () => void) {}

  apply(operation: 'toast' | 'openDialog' | 'closeDialog', id: string, value: Json | undefined, signal: AbortSignal): Json {
    if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Feedback scope is inactive');
    const previous = this.#entries.get(id);
    previous?.cleanup();
    const kind = operation === 'toast' ? 'toast' : 'dialog';
    const open = operation !== 'closeDialog';
    const revision = ++this.#revision;
    const owner = Symbol(id);
    const aborted = () => {
      if (this.#entries.get(id)?.owner !== owner) return;
      this.#entries.delete(id);
    };
    signal.addEventListener('abort', aborted, { once: true });
    this.#entries.set(id, {
      kind, open, ...(value === undefined ? {} : { value }), revision, owner,
      cleanup: () => signal.removeEventListener('abort', aborted),
    });
    this.changed();
    return value ?? null;
  }

  snapshot(id: string, kind: FeedbackSnapshot['kind']): FeedbackSnapshot | undefined {
    const entry = this.#entries.get(id);
    return entry?.kind === kind ? entry : undefined;
  }

  close(id: string, kind: FeedbackSnapshot['kind']): void {
    const entry = this.#entries.get(id);
    if (!entry || entry.kind !== kind || !entry.open) return;
    this.#entries.set(id, { ...entry, open: false, revision: ++this.#revision });
    this.changed();
  }

  dispose(): void {
    this.#entries.forEach(entry => entry.cleanup());
    this.#entries.clear();
  }
}
