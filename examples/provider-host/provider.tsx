import * as React from 'react';
import { createPortal } from 'react-dom';
import { jsx } from 'react/jsx-runtime';
import * as Switch from '@radix-ui/react-switch';
import clsx from 'clsx';
import type { ProbeProvider, ProbeSdk } from '../../src/host/install/provider-probe';

declare const PROBE_REVISION: string;

export default function register(sdk: ProbeSdk): ProbeProvider {
  const dependency = sdk.require('./node_modules/clsx/package.json') as { version: string };
  function Widget() {
    const [checked, setChecked] = React.useState(false);
    React.useEffect(() => {
      sdk.record('mount');
      const listener = () => sdk.record('ping');
      window.addEventListener('provider-probe-ping', listener);
      return () => {
        window.removeEventListener('provider-probe-ping', listener);
        sdk.record('dispose');
      };
    }, []);
    return (
      <section className={clsx('provider-widget', checked && 'checked')}>
        <p>Provider {PROBE_REVISION} · private clsx {dependency.version}</p>
        <Switch.Root aria-label="Dependency widget switch" checked={checked} onCheckedChange={setChecked}>
          <Switch.Thumb />
        </Switch.Root>
        <output data-probe-value>{checked ? 'on' : 'off'}</output>
        <img alt="Packaged fixture marker" src={sdk.assetUrl('assets/marker.svg')} width="24" height="24" />
      </section>
    );
  }
  return {
    Widget,
    revision: PROBE_REVISION,
    dependencyVersion: dependency.version,
    dependencyPath: sdk.require.resolve('clsx'),
    shared: {
      react: React.useState === (sdk.sharedModules.react as typeof React).useState,
      reactDom: createPortal === (sdk.sharedModules['react-dom'] as { createPortal: typeof createPortal }).createPortal,
      jsx: jsx === (sdk.sharedModules['react/jsx-runtime'] as { jsx: typeof jsx }).jsx,
    },
  };
}
