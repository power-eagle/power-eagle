import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import type { ExportDescriptor } from '../schema/model';
import {
  defineActionProvider, defineServiceProvider, defineStylingProvider, defineWidgetProvider, type ActionImplementation, type ProviderSdk,
} from './provider';

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const sdk: ProviderSdk = {
  packageId: 'example.sdk', packageRoot: 'C:\\example', require,
  sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime },
  assetUrl: relative => `asset:${relative}`,
};

describe('compiled provider SDK factories', () => {
  it('creates typed widget and styling contributions', () => {
    const render = vi.fn(() => null);
    const activate = vi.fn();
    const widget: Extract<ExportDescriptor, { kind: 'widget' }> = {
      kind: 'widget', id: 'card', contract: {
        properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: [],
        example: { type: 'example.sdk/card' },
      },
    };
    const styling: Extract<ExportDescriptor, { kind: 'styling' }> = { kind: 'styling', id: 'dark', tokens: emptyObject, targets: ['example.sdk/card'] };

    expect(defineWidgetProvider([{ descriptor: widget, implementation: { render }, activate }])(sdk)).toMatchObject({ kind: 'widget', exports: [{ descriptor: widget, activate }] });
    expect(defineStylingProvider(current => [{
      descriptor: styling,
      implementation: { tokens: { asset: current.assetUrl('theme.css') }, variants: {}, overrides: {} },
    }])(sdk)).toMatchObject({ kind: 'styling', exports: [{ implementation: { tokens: { asset: 'asset:theme.css' } } }] });
  });

  it('creates action and service contributions with executable invokers', async () => {
    const actionDescriptor: Extract<ExportDescriptor, { kind: 'action' }> = { kind: 'action', id: 'copy', contract: { input: emptyObject, output: emptyObject } };
    const serviceDescriptor: Extract<ExportDescriptor, { kind: 'service' }> = { kind: 'service', id: 'files', methods: { list: { input: emptyObject, output: emptyObject } } };
    const invoke = vi.fn(async () => ({}));
    const action = defineActionProvider([{ descriptor: actionDescriptor, implementation: { invoke } }])(sdk);
    const service = defineServiceProvider([{ descriptor: serviceDescriptor, implementation: { methods: { list: invoke } } }])(sdk);

    await (action.exports[0].implementation as ActionImplementation).invoke({}, { signal: new AbortController().signal, use: () => () => {} });
    expect(service).toMatchObject({ kind: 'service', exports: [{ descriptor: serviceDescriptor }] });
    expect(invoke).toHaveBeenCalledOnce();
  });
});
