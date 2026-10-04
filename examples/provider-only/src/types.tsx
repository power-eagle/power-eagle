import clsx from 'clsx';
import { useState } from 'react';
import {
  defineWidgetProvider, type ProviderWidgetRenderProps, type WidgetProviderExport,
} from '@power-eagle/sdk';
import manifest from '../manifest.json';

const descriptor = manifest.exports[0] as unknown as WidgetProviderExport['descriptor'];

const ProviderOnlyContribution = defineWidgetProvider(sdk => {
  const dependency = sdk.require('./node_modules/clsx/package.json') as { version: string };
  const icon = sdk.assetUrl('assets/bolt.svg');

  function ProviderToggle({ props, style, events }: ProviderWidgetRenderProps) {
    const [active, setActive] = useState(false);
    return (
      <button
        type="button"
        aria-pressed={active}
        className={clsx('provider-toggle', active && 'provider-toggle-active')}
        data-dependency-version={dependency.version}
        style={style}
        onClick={() => {
          const next = !active;
          setActive(next);
          void events.change?.(next);
        }}
      >
        <img src={icon} alt="" width="16" height="16" />
        {String(props.label)}: {active ? 'on' : 'off'}
      </button>
    );
  }

  return [{ descriptor, implementation: { render: ProviderToggle } }];
});

export default ProviderOnlyContribution;
