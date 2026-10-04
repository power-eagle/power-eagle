export type Disposer = () => void | Promise<void>;

export class DisposedScopeError extends Error {
  constructor(readonly scopeId: string) {
    super(`Runtime scope ${scopeId} is no longer active`);
    this.name = 'DisposedScopeError';
  }
}

/** Owns cancellable work and resources for one activation of a view. */
export class ActivationScope {
  readonly controller = new AbortController();
  #active = true;
  #disposers: Disposer[] = [];
  constructor(readonly id: string) {}
  get active(): boolean { return this.#active; }
  get signal(): AbortSignal { return this.controller.signal; }
  use(disposer: Disposer): () => void {
    this.assertActive();
    this.#disposers.push(disposer);
    return () => { this.#disposers = this.#disposers.filter(item => item !== disposer); };
  }
  assertActive(): void { if (!this.#active) throw new DisposedScopeError(this.id); }
  async dispose(): Promise<void> {
    if (!this.#active) return;
    this.#active = false;
    this.controller.abort(new DisposedScopeError(this.id));
    const disposers = this.#disposers.splice(0).reverse();
    const results = await Promise.allSettled(disposers.map(dispose => dispose()));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
