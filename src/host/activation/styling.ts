import type { Json } from '../../sdui/schema/model';
import type { StylingImplementation } from '../../sdui/sdk/provider';
import type { ActivationSnapshot } from './controller';
import type { EffectiveRegistry } from './enablement';

export interface ActiveStyling {
  identity: string;
  targets: readonly string[];
  implementation: StylingImplementation;
}

export interface OrderedStyleSelection {
  identity: string;
  order: number;
  variants?: readonly string[];
  required?: boolean;
}

export interface StyleCompositionInput {
  widget: string;
  host: { tokens: Record<string, Json>; style: Record<string, Json> };
  packageThemes?: readonly OrderedStyleSelection[];
  viewThemes?: readonly OrderedStyleSelection[];
  nodeStyle?: Record<string, Json>;
}

export interface ComposedStyle {
  tokens: Record<string, Json>;
  style: Record<string, Json>;
  applied: string[];
}

export class StyleCompositionError extends Error {
  constructor(public readonly code: 'invalid-style' | 'duplicate-order' | 'required-style-unavailable' | 'unknown-variant', message: string) {
    super(message);
    this.name = 'StyleCompositionError';
  }
}

function object(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function implementation(value: unknown, identity: string): StylingImplementation {
  const item = value as Partial<StylingImplementation> | undefined;
  if (!item || !object(item.tokens) || !object(item.variants) || !object(item.overrides) ||
    Object.values(item.variants).some(value => !object(value)) || Object.values(item.overrides).some(value => !object(value))) {
    throw new StyleCompositionError('invalid-style', `Styling export ${identity} has an invalid implementation`);
  }
  return item as StylingImplementation;
}

export function collectActiveStyling(registry: EffectiveRegistry, snapshot: ActivationSnapshot): ReadonlyMap<string, ActiveStyling> {
  const catalog = new Map<string, ActiveStyling>();
  snapshot.styling.forEach((registration, identity) => {
    const active = registry.active.get(identity);
    if (!active) return;
    const descriptor = active.descriptor;
    if (descriptor.kind !== 'styling') return;
    const value = implementation(registration.value, identity);
    const undeclared = Object.keys(value.overrides).filter(target => !descriptor.targets.includes(target)).sort();
    if (undeclared.length) {
      throw new StyleCompositionError('invalid-style', `Styling export ${identity} overrides undeclared targets: ${undeclared.join(', ')}`);
    }
    catalog.set(identity, { identity, targets: descriptor.targets, implementation: value });
  });
  return catalog;
}

function ordered(selections: readonly OrderedStyleSelection[], layer: string): OrderedStyleSelection[] {
  const indexes = new Set<number>();
  selections.forEach(selection => {
    if (!Number.isSafeInteger(selection.order)) throw new StyleCompositionError('duplicate-order', `${layer} style ${selection.identity} needs an integer order`);
    if (indexes.has(selection.order)) throw new StyleCompositionError('duplicate-order', `${layer} styles share order ${selection.order}`);
    indexes.add(selection.order);
  });
  return [...selections].sort((left, right) => left.order - right.order || left.identity.localeCompare(right.identity));
}

export function composeStyle(catalog: ReadonlyMap<string, ActiveStyling>, input: StyleCompositionInput): ComposedStyle {
  const tokens = { ...input.host.tokens };
  const style = { ...input.host.style };
  const applied: string[] = [];
  const apply = (selection: OrderedStyleSelection, layer: string) => {
    const active = catalog.get(selection.identity);
    if (!active) {
      if (selection.required) throw new StyleCompositionError('required-style-unavailable', `Required ${layer} style ${selection.identity} is unavailable`);
      return;
    }
    Object.assign(tokens, active.implementation.tokens);
    if (active.targets.includes(input.widget)) {
      Object.assign(style, active.implementation.overrides[input.widget] ?? {});
      for (const variant of selection.variants ?? []) {
        const values = active.implementation.variants[variant];
        if (!values) throw new StyleCompositionError('unknown-variant', `Styling export ${selection.identity} has no variant ${variant}`);
        Object.assign(style, values);
      }
    }
    applied.push(selection.identity);
  };
  ordered(input.packageThemes ?? [], 'package').forEach(selection => apply(selection, 'package'));
  ordered(input.viewThemes ?? [], 'view').forEach(selection => apply(selection, 'view'));
  Object.assign(style, input.nodeStyle ?? {});
  return { tokens, style, applied };
}
