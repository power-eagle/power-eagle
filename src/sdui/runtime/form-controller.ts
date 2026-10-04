import type { Json } from '../schema/model';

export type FormOperation = 'validate' | 'submit' | 'reset';
export interface RuntimeFormHandle {
  run(operation: FormOperation, signal: AbortSignal): Json | Promise<Json>;
}
export type ExternalFormAdapter = (operation: FormOperation, id: string, signal: AbortSignal) => Json | Promise<Json>;

export class FormController {
  #forms = new Map<string, Set<RuntimeFormHandle>>();
  #running = new Set<string>();

  constructor(private readonly external?: ExternalFormAdapter) {}

  register(id: string, handle: RuntimeFormHandle): () => void {
    const handles = this.#forms.get(id) ?? new Set<RuntimeFormHandle>();
    handles.add(handle);
    this.#forms.set(id, handles);
    return () => {
      handles.delete(handle);
      if (!handles.size) this.#forms.delete(id);
    };
  }

  async run(operation: FormOperation, id: string, signal: AbortSignal): Promise<Json> {
    if (signal.aborted) throw new DOMException('Form operation was aborted', 'AbortError');
    const handles = this.#forms.get(id);
    if (!handles?.size) {
      if (this.external) return this.external(operation, id, signal);
      throw new Error(`Unknown form ${id}`);
    }
    if (handles.size > 1) throw new Error(`Duplicate active form id ${id}`);
    const key = `${id}:${operation}`;
    if (this.#running.has(key)) throw new Error(`Recursive form operation ${key}`);
    this.#running.add(key);
    try {
      const result = await [...handles][0].run(operation, signal);
      if (signal.aborted) throw new DOMException('Form operation was aborted', 'AbortError');
      return result;
    } finally {
      this.#running.delete(key);
    }
  }

  clear(): void {
    this.#forms.clear();
    this.#running.clear();
  }
}
