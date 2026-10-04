import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot, type Root } from 'react-dom/client';
import { createProbeLoader, type ProbeProvider } from '../host/install/provider-probe';

type FixtureLocation = 'repository' | 'standalone';

interface HostGlobals {
  require?: NodeRequire;
  eagle?: { app?: { version?: string; build?: number } };
  __providerProbeReport?: ProviderProbeReport;
}

interface ProviderProbeCheck {
  name: string;
  passed: boolean;
}

export interface ProviderProbeReport {
  actualEagle: boolean;
  moduleBridge: boolean;
  mode: FixtureLocation;
  passed: boolean;
  checks: ProviderProbeCheck[];
  events: string[];
  runtime?: NodeJS.ProcessVersions;
  eagle?: { version?: string; build?: number };
  platform?: string;
  timestamp?: string;
  fixtureDirectory?: string;
  packages?: Array<Pick<ProbeProvider, 'revision' | 'dependencyVersion' | 'dependencyPath' | 'shared'>>;
  resultPath?: string;
  error?: string;
  saveError?: string;
}

interface ProviderExperimentProps {
  mode: FixtureLocation;
  autoRun?: boolean;
}

const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 50));
const errorText = (error: unknown) => error instanceof Error ? error.stack ?? error.message : String(error);

function hostGlobals(): HostGlobals {
  return globalThis as unknown as HostGlobals;
}

async function runProviderProbe(mode: FixtureLocation, widgets: HTMLDivElement, publish: (report: ProviderProbeReport) => void): Promise<ProviderProbeReport> {
  const host = hostGlobals();
  const checks: ProviderProbeCheck[] = [];
  const events: string[] = [];
  const report: ProviderProbeReport = {
    actualEagle: Boolean(host.eagle),
    moduleBridge: Boolean(host.require),
    mode,
    passed: false,
    checks,
    events,
  };
  let root: Root | undefined;
  let restore: (() => void) | undefined;
  let save: (() => void) | undefined;

  function check(name: string, condition: boolean): void {
    checks.push({ name, passed: condition });
    publish({ ...report, checks: [...checks], events: [...events] });
    if (!condition) throw new Error(name);
  }

  try {
    if (!host.eagle || !host.require) {
      throw new Error('Open Power Eagle in Eagle; a browser preview cannot establish host support.');
    }
    const fs = host.require('fs') as typeof import('node:fs');
    const path = host.require('path') as typeof import('node:path');
    const url = host.require('url') as typeof import('node:url');
    const process = host.require('process') as NodeJS.Process;
    const pageDirectory = path.dirname(url.fileURLToPath(new URL(location.href)));
    const fixtureDirectory = mode === 'standalone'
      ? pageDirectory
      : path.resolve(pageDirectory, '..', '.artifacts', 'provider-host');
    const packagesDirectory = path.join(fixtureDirectory, 'packages');
    const resultPath = path.join(fixtureDirectory, 'result.json');
    report.runtime = process.versions;
    report.eagle = { version: host.eagle.app?.version, build: host.eagle.app?.build };
    report.platform = `${process.platform}/${process.arch}`;
    report.timestamp = new Date().toISOString();
    report.fixtureDirectory = fixtureDirectory;
    report.resultPath = resultPath;
    save = () => fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));

    check('Fixture packages are present beside the repository build', fs.existsSync(packagesDirectory));
    const loader = createProbeLoader(host.require);
    const alphaPath = path.join(packagesDirectory, 'alpha');
    const betaPath = path.join(packagesDirectory, 'beta');
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
    const runtime = JSON.parse(fs.readFileSync(path.join(alphaPath, 'run.json'), 'utf8')) as {
      format?: string;
      screen?: { type?: string };
    };
    check('Fixture JSON selects the compiled widget', runtime.format === 'power-eagle/runtime' && runtime.screen?.type === 'probe.alpha/switch');
    const fixtureRegistry = { 'probe.alpha/switch': alpha };
    report.packages = [alpha, beta].map(({ revision, dependencyVersion, dependencyPath, shared }) => ({
      revision,
      dependencyVersion,
      dependencyPath,
      shared,
    }));
    check('Separate private dependency versions', alpha.dependencyVersion === '1.2.1' && beta.dependencyVersion === '2.1.1');
    check('Private dependencies resolve from their owning packages', alpha.dependencyPath.startsWith(alphaPath + path.sep) && beta.dependencyPath.startsWith(betaPath + path.sep));
    check('All provider React/DOM/JSX imports share the host runtime', [alpha, beta].every(provider => Object.values(provider.shared).every(Boolean)));

    const mount = async (provider: ProbeProvider) => {
      root = createRoot(widgets);
      ReactDOM.flushSync(() => root!.render(React.createElement(provider.Widget)));
      await tick();
    };
    await mount(fixtureRegistry[runtime.screen!.type as keyof typeof fixtureRegistry]);
    const control = widgets.querySelector<HTMLButtonElement>('[role="switch"]');
    check('Hook-using Radix switch renders', Boolean(control) && control?.getAttribute('aria-checked') === 'false');
    control!.click();
    await tick();
    check('Third-party switch updates provider hook state', control!.getAttribute('aria-checked') === 'true' && widgets.querySelector('output')?.textContent === 'on');
    const marker = widgets.querySelector<HTMLImageElement>('img');
    check('Provider supplies its package-relative image', Boolean(marker));
    await Promise.race([
      marker!.decode(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Asset load timeout')), 5000)),
    ]);
    check('Package-relative asset loads', marker!.naturalWidth === 24);

    window.dispatchEvent(new Event('provider-probe-ping'));
    root!.unmount();
    root = undefined;
    window.dispatchEvent(new Event('provider-probe-ping'));
    check('Disable unmounts and removes listeners', events.filter(event => event === 'alpha:dispose').length === 1 && events.filter(event => event === 'alpha:ping').length === 1);
    await mount(alpha);
    window.dispatchEvent(new Event('provider-probe-ping'));
    check('Re-enable resets view state without duplicate listeners', widgets.querySelector('output')?.textContent === 'off' && events.filter(event => event === 'alpha:ping').length === 2);
    root!.unmount();
    root = undefined;

    const betaRequire = host.require('module').createRequire(path.join(betaPath, 'package.json')) as NodeRequire;
    const betaDependency = betaRequire('clsx');
    fs.copyFileSync(path.join(alphaPath, 'types.next.cjs'), path.join(alphaPath, 'types.cjs'));
    loader.clear(alphaPath);
    const updated = loader.load(alphaPath, sharedModules, event => events.push(`updated:${event}`));
    await mount(updated);
    check('Changed-code reload renders updated provider', updated.revision === 'updated' && widgets.textContent?.includes('updated') === true);
    check('Reload preserves unrelated dependency instance', betaRequire('clsx') === betaDependency);
    root!.unmount();
    root = undefined;
    check('All mounted providers disposed', events.filter(event => event.endsWith(':mount')).length === events.filter(event => event.endsWith(':dispose')).length);
    report.passed = true;
  } catch (error) {
    report.error = errorText(error);
  } finally {
    root?.unmount();
    restore?.();
    host.__providerProbeReport = report;
    try {
      save?.();
    } catch (error) {
      report.saveError = errorText(error);
    }
    publish({ ...report, checks: [...checks], events: [...events] });
  }
  return report;
}

export function ProviderExperiment({ mode, autoRun = false }: ProviderExperimentProps) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const started = React.useRef(false);
  const [running, setRunning] = React.useState(false);
  const [report, setReport] = React.useState<ProviderProbeReport | null>(null);

  const run = React.useCallback(async () => {
    if (!mountRef.current || running) return;
    setRunning(true);
    try {
      await runProviderProbe(mode, mountRef.current, setReport);
    } finally {
      setRunning(false);
    }
  }, [mode, running]);

  React.useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void run();
    }
  }, [autoRun, run]);

  const hostAvailable = Boolean(hostGlobals().eagle && hostGlobals().require);
  return <section aria-labelledby="provider-experiment-title">
    <h2 id="provider-experiment-title">Compiled provider host experiment</h2>
    <p>{hostAvailable
      ? 'Running inside Eagle with its module bridge. Results are written to .artifacts/provider-host/result.json.'
      : 'Eagle and its module bridge are required for this check.'}</p>
    <button type="button" disabled={running || !hostAvailable} onClick={() => void run()}>{running ? 'Running checks…' : 'Run provider checks'}</button>
    {report && <p role="status">{report.passed ? 'All provider host checks passed.' : report.error ? 'Provider host checks failed.' : 'Provider host checks are running.'}</p>}
    <pre>{report ? JSON.stringify(report, null, 2) : 'No host result yet.'}</pre>
    <div ref={mountRef} aria-label="Provider fixture mount" />
  </section>;
}
