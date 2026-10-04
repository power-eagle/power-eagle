import type * as React from 'react';
import type * as ReactDOM from 'react-dom';
import type * as JsxRuntime from 'react/jsx-runtime';
import type { ExportDescriptor, Json } from '../schema/model';

export type ExecutableExportKind = 'widget' | 'styling' | 'action' | 'service';

export interface SharedRuntimeModules extends Readonly<Record<string, unknown>> {
  react: typeof React;
  'react-dom': typeof ReactDOM;
  'react/jsx-runtime': typeof JsxRuntime;
  'react/jsx-dev-runtime'?: typeof import('react/jsx-dev-runtime');
}

export interface ProviderSdk {
  packageId: string;
  packageRoot: string;
  require: NodeRequire;
  sharedModules: SharedRuntimeModules;
  assetUrl(relativePath: string): string;
}

export interface ProviderWidgetRenderProps {
  props: Record<string, Json>;
  style: React.CSSProperties;
  slots: Record<string, React.ReactNode>;
  events: Record<string, (payload?: Json) => Promise<Json>>;
}

export interface WidgetImplementation {
  render(props: ProviderWidgetRenderProps): React.ReactElement | null;
}

export interface InvocationContext {
  method?: string;
  signal: AbortSignal;
  use(disposer: () => void | Promise<void>): () => void;
}

export interface ProviderServiceHandle {
  invoke(method: string, args: Json, context: InvocationContext): Promise<Json>;
}

export interface ProviderActivationContext {
  signal: AbortSignal;
  use(disposer: () => void | Promise<void>): () => void;
  service(identity: string): ProviderServiceHandle;
}

export type ProviderActivation = (context: ProviderActivationContext) => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>;

export interface ActionImplementation {
  invoke(args: Json, context: InvocationContext): Json | Promise<Json>;
}

export interface ServiceImplementation {
  methods: Record<string, (args: Json, context: InvocationContext) => Json | Promise<Json>>;
}

export interface StylingImplementation {
  tokens: Record<string, Json>;
  variants: Record<string, Record<string, Json>>;
  overrides: Record<string, Record<string, Json>>;
}

export interface CompiledProviderExport<D extends ExportDescriptor = ExportDescriptor, I = unknown> {
  descriptor: D;
  implementation: I;
  activate?: ProviderActivation;
}

export interface CompiledContribution<K extends ExecutableExportKind = ExecutableExportKind> {
  format: 'power-eagle/provider';
  formatVersion: 1;
  kind: K;
  exports: CompiledProviderExport[];
}

export type ProviderFactory = (sdk: ProviderSdk) => CompiledContribution;

type Descriptor<K extends ExportDescriptor['kind']> = Extract<ExportDescriptor, { kind: K }>;
type Definition<K extends ExportDescriptor['kind'], I> = CompiledProviderExport<Descriptor<K>, I>;
type DefinitionSource<T> = readonly T[] | ((sdk: ProviderSdk) => readonly T[]);

function factory<K extends ExecutableExportKind, T extends CompiledProviderExport>(kind: K, source: DefinitionSource<T>): ProviderFactory {
  return sdk => ({
    format: 'power-eagle/provider',
    formatVersion: 1,
    kind,
    exports: [...(typeof source === 'function' ? source(sdk) : source)],
  });
}

export type WidgetProviderExport = Definition<'widget', WidgetImplementation>;
export type StylingProviderExport = Definition<'styling', StylingImplementation>;
export type ActionProviderExport = Definition<'action', ActionImplementation>;
export type ServiceProviderExport = Definition<'service', ServiceImplementation>;

export const defineWidgetProvider = (source: DefinitionSource<WidgetProviderExport>): ProviderFactory => factory('widget', source);
export const defineStylingProvider = (source: DefinitionSource<StylingProviderExport>): ProviderFactory => factory('styling', source);
export const defineActionProvider = (source: DefinitionSource<ActionProviderExport>): ProviderFactory => factory('action', source);
export const defineServiceProvider = (source: DefinitionSource<ServiceProviderExport>): ProviderFactory => factory('service', source);
