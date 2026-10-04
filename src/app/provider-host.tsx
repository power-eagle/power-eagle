import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot, type Root } from 'react-dom/client';
import { createProbeLoader, type ProbeProvider } from '../host/install/provider-probe';

const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const host = window as unknown as {
  require?: NodeRequire;
  eagle?: { app?: { version?: string; build?: string } };
  __providerProbeReport?: unknown;
};
const panel = document.getElementById('fixture')!;
panel.innerHTML = '<h1>Power Eagle provider experiment</h1><p>This isolated test writes only inside its own build directory.</p><button id="run">Run checks</button><pre id="report"></pre><div id="widgets"></div>';
const output = document.getElementById('report')!;
const button = document.getElementById('run') as HTMLButtonElement;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 50));

async function run() {
  button.disabled = true;
  const checks: Array<{ name: string; passed: boolean }> = [];
  const events: string[] = [];
  const report: Record<string, unknown> = { actualEagle: Boolean(host.eagle), checks, events, passed: false };
  let root: Root | undefined;
  let restore: (() => void) | undefined;
  let save: (() => void) | undefined;
  function check(name: string, condition: boolean) {
    checks.push({ name, passed: condition });
    output.textContent = JSON.stringify(report, null, 2);
    if (!condition) throw new Error(name);
  }
  try {
    if (!host.eagle || !host.require) throw new Error('Open this fixture as an Eagle development plugin; a browser preview cannot establish host support.');
    const fs = host.require('fs') as typeof import('node:fs');
    const path = host.require('path') as typeof import('node:path');
    const url = host.require('url') as typeof import('node:url');
    const process = host.require('process') as NodeJS.Process;
    const directory = path.dirname(url.fileURLToPath(location.href.split('?')[0]));
    report.runtime = process.versions;
    report.eagle = { version: host.eagle.app?.version, build: host.eagle.app?.build };
    report.platform = `${process.platform}/${process.arch}`;
    report.timestamp = new Date().toISOString();
    save = () => fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(report, null, 2));
    const loader = createProbeLoader(host.require);
    const alphaPath = path.join(directory, 'packages/alpha');
    const betaPath = path.join(directory, 'packages/beta');
    loader.clear(alphaPath);
    loader.clear(betaPath);
    const original = fs.readFileSync(path.join(alphaPath, 'types.cjs'));
    restore = () => {
      fs.writeFileSync(path.join(alphaPath, 'types.cjs'), original);
      loader.clear(alphaPath);
      loader.clear(betaPath);
    };
    const alpha = loader.load(alphaPath, sharedModules, event => events.push(`alpha:${event}`));
    const beta = loader.load(betaPath, sharedModules, event => events.push(`beta:${event}`));
    const runtime = JSON.parse(fs.readFileSync(path.join(alphaPath, 'run.json'), 'utf8'));
    check('Fixture JSON selects the compiled widget', runtime.format === 'power-eagle/runtime' && runtime.screen.type === 'probe.alpha/switch');
    const fixtureRegistry = { 'probe.alpha/switch': alpha };
    report.packages = [alpha, beta].map(({ revision, dependencyVersion, dependencyPath, shared }) => ({ revision, dependencyVersion, dependencyPath, shared }));
    check('Separate private dependency versions', alpha.dependencyVersion === '1.2.1' && beta.dependencyVersion === '2.1.1');
    check('All provider React/DOM/JSX imports share the host runtime', [alpha, beta].every(provider => Object.values(provider.shared).every(Boolean)));
    const widgets = document.getElementById('widgets')!;
    const mount = async (provider: ProbeProvider) => {
      root = createRoot(widgets);
      ReactDOM.flushSync(() => root!.render(React.createElement(provider.Widget)));
      await tick();
    };
    await mount(fixtureRegistry[runtime.screen.type as keyof typeof fixtureRegistry]);
    const control = widgets.querySelector<HTMLButtonElement>('[role="switch"]')!;
    check('Hook-using Radix switch renders', Boolean(control) && control.getAttribute('aria-checked') === 'false');
    control.click();
    await tick();
    check('Third-party switch updates provider hook state', control.getAttribute('aria-checked') === 'true' && widgets.querySelector('output')?.textContent === 'on');
    const marker = widgets.querySelector('img')!;
    await Promise.race([marker.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Asset load timeout')), 5000))]);
    check('Package-relative asset loads', marker.naturalWidth === 24);
    window.dispatchEvent(new Event('provider-probe-ping'));
    root!.unmount(); root = undefined;
    window.dispatchEvent(new Event('provider-probe-ping'));
    check('Disable unmounts and removes listeners', events.filter(event => event === 'alpha:dispose').length === 1 && events.filter(event => event === 'alpha:ping').length === 1);
    await mount(alpha);
    window.dispatchEvent(new Event('provider-probe-ping'));
    check('Re-enable resets view state without duplicate listeners', widgets.querySelector('output')?.textContent === 'off' && events.filter(event => event === 'alpha:ping').length === 2);
    root!.unmount(); root = undefined;
    const betaRequire = host.require('module').createRequire(path.join(betaPath, 'package.json')) as NodeRequire;
    const betaDependency = betaRequire('clsx');
    fs.copyFileSync(path.join(alphaPath, 'types.next.cjs'), path.join(alphaPath, 'types.cjs'));
    loader.clear(alphaPath);
    const updated = loader.load(alphaPath, sharedModules, event => events.push(`updated:${event}`));
    await mount(updated);
    check('Changed-code reload renders updated provider', updated.revision === 'updated' && widgets.textContent?.includes('updated') === true);
    check('Reload preserves unrelated dependency instance', betaRequire('clsx') === betaDependency);
    root!.unmount(); root = undefined;
    check('All mounted providers disposed', events.filter(event => event.endsWith(':mount')).length === events.filter(event => event.endsWith(':dispose')).length);
    report.passed = true;
  } catch (error) {
    report.error = error instanceof Error ? error.stack : String(error);
  } finally {
    root?.unmount();
    restore?.();
    host.__providerProbeReport = report;
    output.textContent = JSON.stringify(report, null, 2);
    save?.();
    button.disabled = false;
  }
}
button.addEventListener('click', () => void run());
if (host.eagle && host.require) void run();
