import clsx from 'clsx';
import { useState } from 'react';
import {
  defineWidgetProvider, type ProviderWidgetRenderProps, type WidgetProviderExport,
} from '@power-eagle/sdk';
import manifest from '../manifest.json';

const descriptor = manifest.exports.find(item => item.kind === 'widget') as unknown as WidgetProviderExport['descriptor'];

const MixedWidgetContribution = defineWidgetProvider(sdk => {
  const dependency = sdk.require('./node_modules/clsx/package.json') as { version: string };
  const icon = sdk.assetUrl('assets/layers.svg');

  function MixedCounter({ props, style, events }: ProviderWidgetRenderProps) {
    const [count, setCount] = useState(0);
    return (
      <button
        type="button"
        className={clsx('mixed-counter', count > 0 && 'mixed-counter-active')}
        data-dependency-version={dependency.version}
        style={style}
        onClick={() => {
          const next = count + 1;
          setCount(next);
          void events.change?.(next);
        }}
      >
        <img src={icon} alt="" width="16" height="16" />
        {String(props.label)}: {count}
      </button>
    );
  }

  return [{ descriptor, implementation: { render: MixedCounter } }];
});

export default MixedWidgetContribution;
