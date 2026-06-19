/**
 * @peagle/sdui — public contract types for the v3 (typed-JS, in-process) plugin model.
 * See docs/sdui-spec-v3.md. This file is declarations only; no runtime behavior.
 */

// ── Reactivity ──────────────────────────────────────────────────────────────

/** A read accessor for a reactive value. Calling it reads (and tracks) the value. */
export interface Accessor<T> {
  (): T;
}

/** A boolean accessor with the small derive helpers used in views. */
export interface BoolAccessor extends Accessor<boolean> {
  not(): Accessor<boolean>;
}

/** The `s` argument in `view`/`derived`: each state & derived key exposed as an accessor. */
export type Scope<S> = {
  readonly [K in keyof S]: S[K] extends boolean ? BoolAccessor : Accessor<S[K]>;
};

/** A prop value may be static or a reactive accessor. */
export type Bindable<T> = T | Accessor<T>;

// ── Widgets ─────────────────────────────────────────────────────────────────

/** Event handler attached to a widget; a closure that may run actions. */
export type EventHandler = (...args: unknown[]) => unknown;

/** Per-instance theme override: token-ref or literal style values. */
export type ThemeOverride = Record<string, string | number>;

/** The single uniform node. Everything in a view is one of these. */
export interface Widget {
  type: string;
  props: Record<string, unknown>;
  theme?: ThemeOverride;
  variant?: string;
  children?: Widget[];
  on?: Record<string, EventHandler>;
  when?: Accessor<boolean>;
  key?: string | Accessor<string>;
}

/** Well-known keys recognized in a `w(type, opts)` call; everything else is a prop. */
export interface WidgetOpts {
  children?: Widget[] | string | Bindable<unknown>;
  theme?: ThemeOverride;
  variant?: string;
  when?: Accessor<boolean>;
  key?: string | Accessor<string>;
  // list control-flow
  for?: Accessor<readonly unknown[]>;
  render?: (item: Accessor<unknown>, index: Accessor<number>) => Widget;
  empty?: Widget;
  // any other key is a widget-specific prop, value or accessor
  [prop: string]: unknown;
}

/** Canonical builder: discriminator is positional so a `type` prop never collides. */
export type W = (type: string, opts?: WidgetOpts) => Widget;

// ── Theming ─────────────────────────────────────────────────────────────────

export interface Tokens {
  color: Record<string, string>;
  space: Record<string, number | string>;
  radius: Record<string, number | string>;
  font: { family?: string; size?: Record<string, number | string>; weight?: Record<string, number | string> };
}

export type StyleTokens = Record<string, string | number>;

export interface Theme {
  tokens?: DeepPartial<Tokens>;
  widgets?: Record<string, { base?: StyleTokens; variants?: Record<string, StyleTokens> }>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// ── Runtime & registries ────────────────────────────────────────────────────

/** Typed facade over the surviving Eagle host bridge (src/sdk). Shape filled by the adapter. */
export interface EagleFacade {
  [namespace: string]: Record<string, (...args: never[]) => Promise<unknown>>;
}

/** The single context passed to actions and onMount. */
export interface Runtime<S = Record<string, unknown>> {
  get(): Readonly<S>;
  set(mutator: (draft: S) => void): void;
  run(action: string, ...args: unknown[]): Promise<unknown>;
  eagle: EagleFacade;
}

export interface WidgetDef<P = Record<string, unknown>> {
  type: string;
  Component: (props: P, style: StyleTokens, ctx: Runtime) => unknown;
  defaultTheme: { base: StyleTokens; variants?: Record<string, StyleTokens> };
  themeSchema: readonly string[];
}

export interface ActionDef<Args extends unknown[] = unknown[]> {
  name: string;
  run: (rt: Runtime, ...args: Args) => Promise<unknown> | unknown;
}

// ── Plugin definition ───────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  keywords?: string[];
}

export interface PluginDef<S extends Record<string, unknown>> {
  manifest: PluginManifest;
  state: () => S;
  derived?: Record<string, (s: Readonly<S>) => unknown>;
  actions?: Record<string, (rt: Runtime<S>, ...args: never[]) => Promise<unknown> | unknown>;
  theme?: Theme;
  onMount?: (rt: Runtime<S>) => unknown;
  view: (s: Scope<S> & { not(a: Accessor<boolean>): Accessor<boolean> }, rt: Runtime<S>) => Widget;
}

/** The compiled, host-loadable module shape. */
export interface PluginModule<S extends Record<string, unknown> = Record<string, unknown>> {
  manifest: PluginManifest;
  __def: PluginDef<S>;
}

/** Authoring entry point. Infers S from `state()` even in .js under checkJs. */
export type DefinePlugin = <S extends Record<string, unknown>>(def: PluginDef<S>) => PluginModule<S>;
